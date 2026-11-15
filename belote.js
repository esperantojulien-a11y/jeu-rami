// ==========================================
// LOGIQUE DE LA BELOTE (V9 - Complète et Stable)
// ==========================================

const couleursBelote = ['coeur', 'carreau', 'trefle', 'pique'];
const valeursBelote = ['7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];
const pointsBelote = { 'as': 11, '10': 10, 'roi': 4, 'dame': 3, 'valet': 2, '9': 0, '8': 0, '7': 0 };
const ordreAtout = ['7', '8', 'dame', 'roi', '10', 'as', '9', 'valet'];
const ordreNormal = ['7', '8', '9', 'valet', 'dame', 'roi', '10', 'as'];

let deckBelote = [];
let joueursBelote = [];
let atoutActuel = null;
let tourActuel = 0;
let pliEnCours = [];
let cartesPli = [];
let scoresBelote = { 1: 0, 2: 0 };
let nombrePli = 0;
let partieBloquee = false; 
let preneur = -1;
let aDitBelote = false;
let aDitRebelote = false;
let beloteJoueur = -1;
let niveauDifficulteBelote = 'facile';
let aAnnonce = false;

// Variables Réseau
let currentUser = null;
let currentRoomId = null;
let isHost = false;
let unsubscribeRoom = null;
let joueursEnLigne = [];
let modeEnLigne = false;
let monSiege = 0;

// ==========================================
// NOTIFICATIONS (TOASTS)
// ==========================================
function afficherToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

// ==========================================
// INITIALISATION RESEAU
// ==========================================
function initBeloteOnline(user) {
    currentUser = user;
    document.getElementById('statut-connexion').textContent = "Connecté ! Prêt à jouer.";
}

function setDifficulteBelote(niveau) {
    niveauDifficulteBelote = niveau;
    ['facile', 'moyen', 'difficile'].forEach(n => document.getElementById(`btn-${n}`).classList.remove('actif'));
    document.getElementById(`btn-${niveau}`).classList.add('actif');
}

async function creerSalonBelote() {
    if (!currentUser) return afficherToast("Connexion en cours...");
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        await window.firebase.setDoc(window.firebase.doc(window.firebase.db, "rooms", roomId), {
            host: currentUser.uid, jeu: "belote", status: "waiting",
            joueurs: [{ uid: currentUser.uid, nom: "Joueur 1 (Hôte)", seat: 0 }]
        });
        currentRoomId = roomId; isHost = true; monSiege = 0; modeEnLigne = true;
        document.getElementById('ecran-accueil').style.display = 'none';
        document.getElementById('ecran-attente').style.display = 'flex';
        document.getElementById('code-salon-affiche').textContent = roomId;
        ecouterSalonBelote(roomId);
    } catch (e) { console.error(e); afficherToast("Erreur de création"); }
}

async function rejoindreSalonBelote() {
    if (!currentUser) return afficherToast("Connexion en cours...");
    const roomId = document.getElementById('input-salon').value.trim().toUpperCase();
    if (roomId.length !== 6) return afficherToast("Code invalide");
    const roomRef = window.firebase.doc(window.firebase.db, "rooms", roomId);
    
    try {
        const docSnap = await window.firebase.getDoc(roomRef);
        if (!docSnap.exists()) return afficherToast("Salon introuvable !");
        let data = docSnap.data();
        if (data.joueurs.length >= 4) return afficherToast("Salon complet !");
        if (data.joueurs.some(j => j.uid === currentUser.uid)) return afficherToast("Déjà dans ce salon !");
        
        const nouveauSiege = data.joueurs.length;
        const nouveauJoueur = { uid: currentUser.uid, nom: `Joueur ${nouveauSiege + 1}`, seat: nouveauSiege };
        await window.firebase.updateDoc(roomRef, { joueurs: window.firebase.arrayUnion(nouveauJoueur) });
        
        currentRoomId = roomId; isHost = false; monSiege = nouveauSiege; modeEnLigne = true;
        document.getElementById('ecran-accueil').style.display = 'none';
        document.getElementById('ecran-attente').style.display = 'flex';
        document.getElementById('code-salon-affiche').textContent = roomId;
        ecouterSalonBelote(roomId);
    } catch (e) { console.error(e); afficherToast("Erreur pour rejoindre"); }
}

function ecouterSalonBelote(roomId) {
    if (unsubscribeRoom) unsubscribeRoom();
    unsubscribeRoom = window.firebase.onSnapshot(window.firebase.doc(window.firebase.db, "rooms", roomId), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            joueursEnLigne = data.joueurs;
            const listeDiv = document.getElementById('liste-joueurs-salon');
            if(listeDiv) {
                listeDiv.innerHTML = "";
                for (let i = 0; i < 4; i++) {
                    const j = joueursEnLigne.find(p => p.seat === i);
                    if (j) listeDiv.innerHTML += `<div>✅ Joueur ${i+1} : ${j.nom}</div>`;
                    else listeDiv.innerHTML += `<div style="color:gray">⏳ En attente (Place ${i+1})...</div>`;
                }
            }
            if (isHost) document.getElementById('btn-lancer-partie-en-ligne').style.display = 'block';
            if (data.status === "playing" && document.getElementById('table-belote').style.display === 'none') {
                document.getElementById('ecran-attente').style.display = 'none';
                document.getElementById('table-belote').style.display = 'flex';
                chargerEtatJeuDepuisReseau(data);
            } else if (data.status === "playing") {
                chargerEtatJeuDepuisReseau(data);
            }
        }
    });
}

function demarrerBeloteEnLigne() {
    if (!isHost) return;
    let joueursComplets = [];
    for (let i = 0; i < 4; i++) {
        let j = joueursEnLigne.find(p => p.seat === i);
        if (j) joueursComplets.push({ id: i, nom: j.nom, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: false, uid: j.uid });
        else joueursComplets.push({ id: i, nom: `IA (Siège ${i+1})`, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: true, uid: "ia" });
    }
    joueursBelote = joueursComplets;
    creerDeckBelote(); distribuerBelote();
    document.getElementById('modal-encheres').style.display = 'flex';
    atoutActuel = null; 
    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
        status: "playing", atout: null, tour: 0, joueurs: joueursBelote, scores: scoresBelote, phase: "encheres"
    });
}

function chargerEtatJeuDepuisReseau(data) {
    atoutActuel = data.atout; tourActuel = data.tour; joueursBelote = data.joueurs; scoresBelote = data.scores;
    if (isHost && data.actionEnAttente) {
        const action = data.actionEnAttente;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "actionEnAttente": null });
        let carteJouee = joueursBelote[action.joueur].main.splice(action.indexCarte, 1)[0];
        if(carteJouee) { pliEnCours.push({ joueur: action.joueur, carte: carteJouee }); cartesPli.push({ joueur: action.joueur, carte: carteJouee }); }
        afficherPli(); tourActuel = (tourActuel + 1) % 4;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "joueurs": joueursBelote, "tour": tourActuel });
        if (joueursBelote[tourActuel].isIA) setTimeout(() => iaJoue(tourActuel), 800);
        if (pliEnCours.length === 4) setTimeout(resoudrePli, 1500);
    }
    if(atoutActuel) afficherAtoutGeant(atoutActuel);
    let maMain = joueursBelote.find(j => j.uid === currentUser.uid)?.main || [];
    afficherMainReseau(maMain); mettreAJourInfos();
    if (isHost && data.phase !== "encheres" && joueursBelote[tourActuel] && joueursBelote[tourActuel].isIA) {
        setTimeout(() => {
            let indexCarte = choisirCarteIA(tourActuel);
            if (indexCarte !== -1) jouerCarteReseau(tourActuel, indexCarte);
        }, 800);
    }
}

// ==========================================
// LOGIQUE LOCALE
// ==========================================
function lancerBelote() {
    document.getElementById('ecran-accueil').style.display = 'none';
    document.getElementById('table-belote').style.display = 'flex';
    modeEnLigne = false;
    joueursBelote = [
        { id: 0, nom: "Vous", main: [], equipe: 1, isIA: false },
        { id: 1, nom: "Gauche", main: [], equipe: 2, isIA: true },
        { id: 2, nom: "Partenaire", main: [], equipe: 1, isIA: true },
        { id: 3, nom: "Droite", main: [], equipe: 2, isIA: true }
    ];
    creerDeckBelote(); distribuerBelote(); lancerEncheres();
    aAnnonce = false;
    document.getElementById('btn-annonces').style.display = 'none';
}

function creerDeckBelote() {
    deckBelote = [];
    for (let couleur of couleursBelote) { for (let valeur of valeursBelote) { deckBelote.push({ valeur, couleur }); } }
    for (let i = deckBelote.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckBelote[i], deckBelote[j]] = [deckBelote[j], deckBelote[i]];
    }
}

function distribuerBelote() {
    joueursBelote.forEach(j => j.main = []);
    for (let i = 0; i < 3; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    for (let i = 0; i < 3; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    for (let i = 0; i < 2; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    trierMains();
}

function trierMains() {
    joueursBelote.forEach(j => {
        j.main.sort((a, b) => {
            if (a.couleur === b.couleur) return ordreNormal.indexOf(a.valeur) - ordreNormal.indexOf(b.valeur);
            return couleursBelote.indexOf(a.couleur) - couleursBelote.indexOf(b.couleur);
        });
    });
    afficherMainBelote();
}

function getSymbole(couleur) {
    if (couleur === 'coeur') return '♥'; if (couleur === 'carreau') return '♦';
    if (couleur === 'trefle') return '♣'; return '♠';
}

function getImageCarte(carte) {
    let valAnglaise = { 'as': 'ace', 'valet': 'jack', 'dame': 'queen', 'roi': 'king' }[carte.valeur] || carte.valeur;
    let coulAnglaise = { 'coeur': 'hearts', 'carreau': 'diamonds', 'trefle': 'clubs', 'pique': 'spades' }[carte.couleur];
    return `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`;
}

function afficherMainBelote() {
    const conteneur = document.getElementById('main-belote'); conteneur.innerHTML = "";
    joueursBelote[0].main.forEach((carte, index) => {
        if (!carte) return;
        const img = document.createElement('img'); img.src = getImageCarte(carte); img.className = "carte-belote";
        img.onclick = () => { if (modeEnLigne) jouerCarteReseau(monSiege, index); else jouerCarte(0, index); };
        conteneur.appendChild(img);
    });
}

function afficherMainReseau(maMain) {
    const conteneur = document.getElementById('main-belote'); conteneur.innerHTML = "";
    maMain.forEach((carte, index) => {
        if (!carte) return;
        const img = document.createElement('img'); img.src = getImageCarte(carte); img.className = "carte-belote";
        img.onclick = () => jouerCarteReseau(monSiege, index);
        conteneur.appendChild(img);
    });
}

function afficherPli() {
    const zone = document.getElementById('zone-pli'); zone.innerHTML = "";
    cartesPli.forEach((item) => {
        if (!item || !item.carte) return;
        const img = document.createElement('img'); img.src = getImageCarte(item.carte); img.className = "carte-pli";
        if (item.joueur === 0) img.classList.add('pli-bas'); else if (item.joueur === 1) img.classList.add('pli-gauche');
        else if (item.joueur === 2) img.classList.add('pli-haut'); else if (item.joueur === 3) img.classList.add('pli-droite');
        zone.appendChild(img);
    });
}

function mettreAJourInfos() {
    if(document.getElementById('score-eq1')) document.getElementById('score-eq1').textContent = scoresBelote[1];
    if(document.getElementById('score-eq2')) document.getElementById('score-eq2').textContent = scoresBelote[2];
    if (joueursBelote.length === 4) {
        document.getElementById('nom-j2').textContent = joueursBelote[2].nom;
        document.getElementById('nom-j1').textContent = joueursBelote[1].nom;
        document.getElementById('nom-j3').textContent = joueursBelote[3].nom;
        document.getElementById('nom-j2').className = `badge-joueur ${tourActuel === 2 ? 'actif' : ''}`;
        document.getElementById('nom-j1').className = `badge-joueur ${tourActuel === 1 ? 'actif' : ''}`;
        document.getElementById('nom-j3').className = `badge-joueur ${tourActuel === 3 ? 'actif' : ''}`;
    }
}

// --- ENCHERES ---
function lancerEncheres() { document.getElementById('modal-encheres').style.display = 'flex'; }

function validerEnchere(couleur) {
    if (couleur) {
        atoutActuel = couleur; preneur = 0;
        afficherAtoutGeant(atoutActuel);
        document.getElementById('modal-encheres').style.display = 'none';
        tourActuel = 0; mettreAJourInfos();
        afficherToast(`Vous avez pris à ${getSymbole(couleur)} !`);
        document.getElementById('btn-annonces').style.display = 'block'; 
    } else {
        document.getElementById('modal-encheres').style.display = 'none';
        afficherToast("Vous avez passé."); iaEnchere(1);
    }
}

function iaEnchere(idJoueur) {
    if (idJoueur > 3) { afficherToast("Tout le monde a passé ! Redistribution."); return lancerBelote(); }
    const main = joueursBelote[idJoueur].main;
    let meilleurAtout = null; let meilleurScore = 0;
    couleursBelote.forEach(couleur => {
        let score = 0;
        main.forEach(c => {
            if (!c) return;
            if (c.couleur === couleur) { score += 4; if (c.valeur === 'valet') score += 10; if (c.valeur === '9') score += 8; }
            else { if (c.valeur === 'as') score += 4; if (c.valeur === '10') score += 3; }
        });
        if (score > meilleurScore) { meilleurScore = score; meilleurAtout = couleur; }
    });

    let seuil = (niveauDifficulteBelote === 'facile') ? 12 : (niveauDifficulteBelote === 'difficile') ? 8 : 10;
    if (meilleurScore >= seuil) {
        atoutActuel = meilleurAtout; preneur = idJoueur;
        afficherAtoutGeant(atoutActuel);
        afficherToast(`${joueursBelote[idJoueur].nom} a pris à ${getSymbole(atoutActuel)} !`);
        trierMains(); tourActuel = idJoueur; mettreAJourInfos();
        document.getElementById('btn-annonces').style.display = 'block';
        setTimeout(() => iaJoue(tourActuel), 800);
    } else {
        afficherToast(`${joueursBelote[idJoueur].nom} passe.`);
        setTimeout(() => iaEnchere(idJoueur + 1), 800);
    }
}

// --- ANNONCES ---
function detecterAnnonces(main, atout) {
    let pointsAnnonces = 0; let messages = [];
    const ordreAnnonce = ['as', 'roi', 'dame', 'valet', '10', '9', '8', '7'];
    let cartesParCouleur = {coeur:[], carreau:[], trefle:[], pique:[]};
    main.forEach(c => { if (c && c.couleur !== atout) cartesParCouleur[c.couleur].push(c.valeur); });

    for (let coul in cartesParCouleur) {
        let valeursPresentes = cartesParCouleur[coul];
        let maxSuite = 0; let suiteActuelle = 0;
        ordreAnnonce.forEach((val) => {
            if (valeursPresentes.includes(val)) { suiteActuelle++; if (suiteActuelle > maxSuite) maxSuite = suiteActuelle; }
            else suiteActuelle = 0;
        });
        if (maxSuite >= 3) {
            let pts = 0; let nom = "";
            if (maxSuite === 3) { pts = 20; nom = "Tierce"; }
            else if (maxSuite === 4) { pts = 50; nom = "Cinquante"; }
            else if (maxSuite >= 5) { pts = 100; nom = "Cent"; }
            pointsAnnonces += pts; messages.push(`${nom} au ${getSymbole(coul)} (${pts} pts)`);
        }
    }
    return { points: pointsAnnonces, messages: messages.join('<br>') };
}

function annoncerPoints() {
    if (aAnnonce) return;
    let res = detecterAnnonces(joueursBelote[0].main, atoutActuel);
    if (res.points > 0) {
        scoresBelote[joueursBelote[0].equipe] += res.points; mettreAJourInfos();
        afficherToast(`Annonces :<br>${res.messages}`);
        aAnnonce = true; document.getElementById('btn-annonces').style.display = 'none';
    } else {
        afficherToast("Aucune annonce (Tierce/50/100) !");
    }
}

// --- JEU ---
function estCoupValide(idJoueur, indexCarte, cartesMain, couleurDemandee) {
    if (!couleurDemandee) return true;
    const carte = cartesMain[indexCarte]; if (!carte) return false;
    const aCouleur = cartesMain.some(c => c && c.couleur === couleurDemandee);
    if (aCouleur && carte.couleur !== couleurDemandee) { if (!modeEnLigne) afficherToast(`Vous devez fournir du ${couleurDemandee} !`); return false; }
    if (!aCouleur && carte.couleur !== atoutActuel) {
        const aAtout = cartesMain.some(c => c && c.couleur === atoutActuel);
        if (aAtout) { if (!modeEnLigne) afficherToast(`Vous devez couper à l'atout !`); return false; }
    }
    return true;
}

function jouerCarte(idJoueur, indexCarte) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(idJoueur, indexCarte, joueursBelote[idJoueur].main, couleurDemandee)) return;

    let carteJouee = joueursBelote[idJoueur].main.splice(indexCarte, 1)[0]; if (!carteJouee) return;
    
    if (carteJouee.couleur === atoutActuel && (carteJouee.valeur === 'roi' || carteJouee.valeur === 'dame')) {
        let aAutreCarte = joueursBelote[idJoueur].main.some(c => c && c.couleur === atoutActuel && (c.valeur === 'roi' || c.valeur === 'dame'));
        if (aAutreCarte && !aDitBelote) {
            aDitBelote = true; beloteJoueur = idJoueur;
            document.getElementById('info-belote-rebelote').style.display = 'block';
            document.getElementById('info-belote-rebelote').textContent = "Belote !";
        } else if (aDitBelote && beloteJoueur === idJoueur) {
            aDitRebelote = true; document.getElementById('info-belote-rebelote').textContent = "Rebelote !";
        }
    }

    pliEnCours.push({ joueur: idJoueur, carte: carteJouee }); cartesPli.push({ joueur: idJoueur, carte: carteJouee });
    afficherPli(); afficherMainBelote();
    
    if (nombrePli === 0) document.getElementById('btn-annonces').style.display = 'none';

    if (pliEnCours.length === 4) { partieBloquee = true; setTimeout(resoudrePli, 1000); }
    else { tourActuel = (tourActuel + 1) % 4; mettreAJourInfos(); if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800); }
}

function jouerCarteReseau(monSiege, indexCarte) {
    if (tourActuel !== monSiege) return afficherToast("Ce n'est pas votre tour !");
    const maMain = joueursBelote.find(j => j.uid === currentUser.uid).main;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(monSiege, indexCarte, maMain, couleurDemandee)) return afficherToast("Coup invalide !");
    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "actionEnAttente": { joueur: monSiege, indexCarte: indexCarte } });
}

function iaJoue(idJoueur) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    let indexCarte = choisirCarteIA(idJoueur); if (indexCarte !== -1) jouerCarte(idJoueur, indexCarte);
}

function choisirCarteIA(idJoueur) {
    const main = joueursBelote[idJoueur].main; if (main.length === 0) return -1;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    let indexCarte = 0;
    if (couleurDemandee) {
        let cartesMemeCouleur = main.map((c, i) => (c && c.couleur === couleurDemandee) ? i : -1).filter(i => i !== -1);
        if (cartesMemeCouleur.length > 0) indexCarte = cartesMemeCouleur[0];
        else {
            let cartesAtout = main.map((c, i) => (c && c.couleur === atoutActuel) ? i : -1).filter(i => i !== -1);
            if (cartesAtout.length > 0) indexCarte = cartesAtout[0];
        }
    }
    return indexCarte;
}

function resoudrePli() {
    const couleurDemandee = pliEnCours[0].carte.couleur;
    let gagnant = pliEnCours[0].joueur; let carteGagnante = pliEnCours[0].carte;

    for (let i = 1; i < 4; i++) {
        const joueur = pliEnCours[i].joueur; const carte = pliEnCours[i].carte;
        if (carte.couleur === atoutActuel && carteGagnante.couleur !== atoutActuel) { gagnant = joueur; carteGagnante = carte; }
        else if (carte.couleur === couleurDemandee && carteGagnante.couleur === couleurDemandee) { if (estPlusForte(carte, carteGagnante)) { gagnant = joueur; carteGagnante = carte; } }
        else if (carte.couleur === atoutActuel && carteGagnante.couleur === atoutActuel) { if (estPlusForte(carte, carteGagnante)) { gagnant = joueur; carteGagnante = carte; } }
    }

    let pointsPli = pliEnCours.reduce((sum, item) => sum + pointsBelote[item.carte.valeur], 0);
    nombrePli++; if (nombrePli === 8) pointsPli += 10;

    if (aDitRebelote) {
        if (joueursBelote[gagnant].equipe === joueursBelote[beloteJoueur].equipe) { pointsPli += 20; afficherToast(`+ 20 pts (Belote-Rebelote) !`); }
        aDitBelote = false; aDitRebelote = false; document.getElementById('info-belote-rebelote').style.display = 'none';
    }

    scoresBelote[joueursBelote[gagnant].equipe] += pointsPli; mettreAJourInfos();
    
    const cartesHTML = document.querySelectorAll('.carte-pli');
    cartesHTML.forEach(img => {
        if (gagnant === 0) img.classList.add('collect', 'pli-bas');
        else if (gagnant === 1) img.classList.add('collect', 'pli-gauche');
        else if (gagnant === 2) img.classList.add('collect', 'pli-haut');
        else if (gagnant === 3) img.classList.add('collect', 'pli-droite');
    });

    afficherToast(`${joueursBelote[gagnant].nom} remporte le pli (${pointsPli} pts)`);

    setTimeout(() => {
        pliEnCours = []; cartesPli = []; document.getElementById('zone-pli').innerHTML = "";
        tourActuel = gagnant; mettreAJourInfos(); partieBloquee = false;
        if (joueursBelote[0].main.length === 0) finDeMancheBelote();
        else { if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800); }
    }, 1000); 
}

function estPlusForte(carte1, carte2) {
    let ordre = (carte1.couleur === atoutActuel) ? ordreAtout : ordreNormal;
    return ordre.indexOf(carte1.valeur) > ordre.indexOf(carte2.valeur);
}

function finDeMancheBelote() {
    if (scoresBelote[1] >= 1000 || scoresBelote[2] >= 1000) {
        let equipeGagnante = scoresBelote[1] >= 1000 ? "Nous (Vous & Partenaire)" : "Eux (Adversaires)";
        afficherToast(`FIN DE LA PARTIE !<br>${equipeGagnante} remporte la partie avec ${Math.max(scoresBelote[1], scoresBelote[2])} points !`);
        setTimeout(() => {
            if (confirm("Voulez-vous rejouer une partie ?")) { scoresBelote = { 1: 0, 2: 0 }; lancerBelote(); }
            else window.location.href = "index.html";
        }, 3000);
    } else {
        afficherToast(`Fin de la manche !<br>Nous : ${scoresBelote[1]} pts<br>Eux : ${scoresBelote[2]} pts`);
        setTimeout(() => { lancerBelote(); }, 2000);
    }
}
function afficherAtoutGeant(couleur) {
    let div = document.getElementById('affichage-atout');
    if (!div) return;
    
    let estRouge = (couleur === 'coeur' || couleur === 'carreau');
    let classeCouleur = estRouge ? 'rouge' : 'noir';
    
    div.innerHTML = `
        <span>Atout</span>
        <div class="badge-atout-symbole ${classeCouleur}">${getSymbole(couleur)}</div>
    `;
    div.classList.add('badge-atout-geant');
}
