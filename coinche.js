// ==========================================
// LOGIQUE DE LA COINCHE (V12 - Parfaite et Stable)
// ==========================================

const couleursBelote = ['coeur', 'carreau', 'trefle', 'pique'];
const valeursBelote = ['7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];
const pointsBelote = { 'as': 11, '10': 10, 'roi': 4, 'dame': 3, 'valet': 2, '9': 0, '8': 0, '7': 0 };
const ordreAtout = ['7', '8', 'dame', 'roi', '10', 'as', '9', 'valet'];
const ordreNormal = ['7', '8', '9', 'valet', 'dame', 'roi', '10', 'as'];

let deck = [];
let joueurs = [];
let atoutActuel = null;
let tourActuel = 0;
let pliEnCours = [];
let cartesPli = [];
let scores = { 1: 0, 2: 0 };
let nombrePli = 0;
let partieBloquee = false; 
let preneur = -1;
let contratValeur = 0;
let coinche = false;
let niveauDifficulteCoinche = 'facile';

let enchereMax = 0;
let couleurChoisie = null;
let passeursConsecutifs = 0;
let historiqueEncheres = ["-", "-", "-", "-"]; 
let aAnnonce = false; 

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
function initCoincheOnline(user) {
    currentUser = user;
    document.getElementById('statut-connexion').textContent = "Connecté ! Prêt à jouer.";
}
function setDifficulteCoinche(niveau) {
    niveauDifficulteCoinche = niveau;
    ['facile', 'moyen', 'difficile'].forEach(n => document.getElementById(`btn-${n}`).classList.remove('actif'));
    document.getElementById(`btn-${niveau}`).classList.add('actif');
}

async function creerSalonCoinche() {
    if (!currentUser) return afficherToast("Connexion en cours...");
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        await window.firebase.setDoc(window.firebase.doc(window.firebase.db, "rooms", roomId), {
            host: currentUser.uid, jeu: "coinche", status: "waiting",
            joueurs: [{ uid: currentUser.uid, nom: "Joueur 1 (Hôte)", seat: 0 }]
        });
        currentRoomId = roomId; isHost = true; monSiege = 0; modeEnLigne = true;
        document.getElementById('ecran-accueil').style.display = 'none';
        document.getElementById('ecran-attente').style.display = 'flex';
        document.getElementById('code-salon-affiche').textContent = roomId;
        ecouterSalonCoinche(roomId);
    } catch (e) { console.error(e); afficherToast("Erreur de création"); }
}

async function rejoindreSalonCoinche() {
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
        ecouterSalonCoinche(roomId);
    } catch (e) { console.error(e); afficherToast("Erreur pour rejoindre"); }
}

function ecouterSalonCoinche(roomId) {
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
            if (data.status === "playing" && document.getElementById('table-coinche').style.display === 'none') {
                document.getElementById('ecran-attente').style.display = 'none';
                document.getElementById('table-coinche').style.display = 'flex';
                chargerEtatJeuDepuisReseau(data);
            } else if (data.status === "playing") {
                chargerEtatJeuDepuisReseau(data);
            }
        }
    });
}

function demarrerCoincheEnLigne() {
    if (!isHost) return;
    let joueursComplets = [];
    for (let i = 0; i < 4; i++) {
        let j = joueursEnLigne.find(p => p.seat === i);
        if (j) joueursComplets.push({ id: i, nom: j.nom, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: false, uid: j.uid });
        else joueursComplets.push({ id: i, nom: `IA (Siège ${i+1})`, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: true, uid: "ia" });
    }
    joueurs = joueursComplets;
    creerDeck(); distribuer();
    document.getElementById('modal-encheres').style.display = 'flex';
    atoutActuel = null; 
    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
        status: "playing", atout: null, tour: 0, joueurs: joueurs, scores: scores, phase: "encheres"
    });
}

function chargerEtatJeuDepuisReseau(data) {
    atoutActuel = data.atout; tourActuel = data.tour; joueurs = data.joueurs; scores = data.scores;
    if (isHost && data.actionEnAttente) {
        const action = data.actionEnAttente;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "actionEnAttente": null });
        let carteJouee = joueurs[action.joueur].main.splice(action.indexCarte, 1)[0];
        if(carteJouee) { pliEnCours.push({ joueur: action.joueur, carte: carteJouee }); cartesPli.push({ joueur: action.joueur, carte: carteJouee }); }
        afficherPli(); tourActuel = (tourActuel + 1) % 4;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "joueurs": joueurs, "tour": tourActuel });
        if (joueurs[tourActuel].isIA) setTimeout(() => iaJoue(tourActuel), 800);
        if (pliEnCours.length === 4) setTimeout(resoudrePli, 1500);
    }
    
    // Affichage de l'atout (sécurisé)
    if(atoutActuel) afficherAtoutGeant(atoutActuel);
    
    let maMain = joueurs.find(j => j.uid === currentUser.uid)?.main || [];
    afficherMainReseau(maMain); mettreAJourInfos();
    if (isHost && data.phase !== "encheres" && joueurs[tourActuel] && joueurs[tourActuel].isIA) {
        setTimeout(() => {
            let indexCarte = choisirCarteIA(tourActuel);
            if (indexCarte !== -1) jouerCarteReseau(tourActuel, indexCarte);
        }, 800);
    }
}

// ==========================================
// LOGIQUE LOCALE
// ==========================================
function lancerCoinche() {
    document.getElementById('ecran-accueil').style.display = 'none';
    document.getElementById('table-coinche').style.display = 'flex';
    modeEnLigne = false;
    joueurs = [
        { id: 0, nom: "Vous", main: [], equipe: 1, isIA: false },
        { id: 1, nom: "Gauche", main: [], equipe: 2, isIA: true },
        { id: 2, nom: "Partenaire", main: [], equipe: 1, isIA: true },
        { id: 3, nom: "Droite", main: [], equipe: 2, isIA: true }
    ];
    creerDeck(); distribuer(); demarrerEncheres();
    aAnnonce = false;
    document.getElementById('btn-annonces').style.display = 'none';
}

function creerDeck() {
    deck = [];
    for (let couleur of couleursBelote) { for (let valeur of valeursBelote) { deck.push({ valeur, couleur }); } }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function distribuer() {
    joueurs.forEach(j => j.main = []);
    // 3 + 3 + 2 = 8 cartes par joueur = 32 cartes
    for (let i = 0; i < 3; i++) joueurs.forEach(j => j.main.push(deck.pop()));
    for (let i = 0; i < 3; i++) joueurs.forEach(j => j.main.push(deck.pop()));
    for (let i = 0; i < 2; i++) joueurs.forEach(j => j.main.push(deck.pop()));
    trierMains();
}

function trierMains() {
    joueurs.forEach(j => {
        j.main.sort((a, b) => {
            if (a.couleur === b.couleur) return ordreNormal.indexOf(a.valeur) - ordreNormal.indexOf(b.valeur);
            return couleursBelote.indexOf(a.couleur) - couleursBelote.indexOf(b.couleur);
        });
    });
    afficherMain();
}

// ==========================================
// PHASE D'ENCHERES
// ==========================================
function demarrerEncheres() {
    document.getElementById('modal-encheres').style.display = 'flex';
    document.getElementById('zone-coinche').style.display = 'none';
    enchereMax = 0; couleurChoisie = null; passeursConsecutifs = 0; historiqueEncheres = ["-", "-", "-", "-"];
    preneur = -1; tourActuel = 0; 
    mettreAJourTableauEncheres(); afficherOptionsEncheres(0);
}

function mettreAJourTableauEncheres() {
    for(let i=0; i<4; i++) {
        document.getElementById(`hist-j${i}`).innerHTML = `<strong>${joueurs[i].nom}</strong>${historiqueEncheres[i]}`;
        document.getElementById(`hist-j${i}`).className = `annonce-joueur ${tourActuel === i ? 'actif' : ''}`;
    }
}

function afficherOptionsEncheres(idJoueur) {
    mettreAJourTableauEncheres();
    if (passeursConsecutifs >= 3 && enchereMax > 0) { finirEncheres(); return; }
    if (passeursConsecutifs >= 4 && enchereMax === 0) { afficherToast("Tout le monde a passé ! Redistribution."); return lancerCoinche(); }

    if (idJoueur === 0) {
        document.getElementById('message-enchere').textContent = "C'est à vous de parler !";
        document.getElementById('zone-choix-atout').style.display = 'block';
        document.getElementById('btn-passer-action').style.display = 'inline-block'; 
        const container = document.getElementById('choix-valeur'); container.innerHTML = "";
        
        [80, 90, 100, 110, 120, 130, 140, 150, 160].forEach(val => {
            if (val > enchereMax) {
                const btn = document.createElement('button'); btn.className = "btn-valeur"; btn.textContent = val;
                btn.onclick = () => validerEnchere(val); container.appendChild(btn);
            }
        });
        if (enchereMax < 250) {
            const btnCapot = document.createElement('button'); btnCapot.className = "btn-valeur speciale";
            btnCapot.textContent = "CAPOT (250)"; btnCapot.onclick = () => validerEnchere(250); container.appendChild(btnCapot);
            const btnGen = document.createElement('button'); btnGen.className = "btn-valeur speciale";
            btnGen.textContent = "GÉNÉRALE (500)"; btnGen.onclick = () => validerEnchere(500); container.appendChild(btnGen);
        }
    } else {
        document.getElementById('message-enchere').textContent = `L'IA ${joueurs[idJoueur].nom} réfléchit...`;
        document.getElementById('zone-choix-atout').style.display = 'none'; 
        document.getElementById('btn-passer-action').style.display = 'none'; 
        setTimeout(() => iaEnchere(idJoueur), 800);
    }
}

let atoutSelectionneEnchere = null;
function selectionnerAtout(couleur, btn) {
    document.querySelectorAll('.btn-couleur').forEach(b => b.style.outline = 'none');
    btn.style.outline = '3px solid #f1c40f'; atoutSelectionneEnchere = couleur;
}

function validerEnchere(valeur) {
    if (!atoutSelectionneEnchere) return afficherToast("Choisissez une couleur !");
    if (valeur <= enchereMax) return afficherToast("Il faut annoncer plus haut !");
    enchereMax = valeur; couleurChoisie = atoutSelectionneEnchere; preneur = 0; passeursConsecutifs = 0;
    historiqueEncheres[0] = `${valeur} ${getSymbole(couleurChoisie)}`;
    afficherToast(`Vous annoncez ${valeur} au ${getSymbole(couleurChoisie)}`);
    passerAuSuivantEnchere();
}

function passerEnchere() {
    historiqueEncheres[tourActuel] = "Passe"; passeursConsecutifs++;
    mettreAJourTableauEncheres(); afficherToast("Vous passez.");
    passerAuSuivantEnchere();
}

function passerAuSuivantEnchere() {
    if (passeursConsecutifs >= 3 && enchereMax > 0) { finirEncheres(); return; }
    if (passeursConsecutifs >= 4 && enchereMax === 0) { afficherToast("Tout le monde a passé ! Redistribution."); return lancerCoinche(); }
    tourActuel = (tourActuel + 1) % 4; afficherOptionsEncheres(tourActuel);
}

function evaluerMain(main) {
    let evalScores = {coeur:0, carreau:0, trefle:0, pique:0}; let basePoints = 0;
    main.forEach(c => { if (!c) return; if (c.valeur === 'as') basePoints += 11; if (c.valeur === '10') basePoints += 10; });
    for (let s of couleursBelote) {
        let score = basePoints; let nbAtouts = 0;
        main.forEach(c => {
            if (!c) return;
            if (c.couleur === s) {
                nbAtouts++;
                if (c.valeur === 'valet') score += 20; else if (c.valeur === '9') score += 14;
                else if (c.valeur === 'as') score += 11; else if (c.valeur === '10') score += 10;
                else if (c.valeur === 'roi') score += 4; else if (c.valeur === 'dame') score += 3;
            }
        });
        if (nbAtouts >= 4) score += 10; if (nbAtouts >= 5) score += 20;
        evalScores[s] = score;
    }
    return evalScores;
}

function iaEnchere(idJoueur) {
    const main = joueurs[idJoueur].main; let evalScores = evaluerMain(main);
    let bestSuit = null; let bestScore = 0;
    for (let s of couleursBelote) { if (evalScores[s] > bestScore) { bestScore = evalScores[s]; bestSuit = s; } }
    
    let seuil = (niveauDifficulteCoinche === 'facile') ? 60 : (niveauDifficulteCoinche === 'difficile' ? 35 : 45);
    let doitParler = false; let nouvelleValeur = enchereMax === 0 ? 80 : enchereMax + 10; let nouvelleCouleur = bestSuit;
    let estPartenaire = (preneur !== -1) && (joueurs[preneur].equipe === joueurs[idJoueur].equipe);
    
    if (estPartenaire) {
        if (enchereMax < 140 && bestScore > 30) { doitParler = true; nouvelleValeur = enchereMax + 10; nouvelleCouleur = couleurChoisie; }
    } else {
        if (bestScore >= seuil && enchereMax < 130) {
            doitParler = true;
            if (couleurChoisie && bestSuit !== couleurChoisie) { if (bestScore > 70) doitParler = true; else doitParler = false; }
        }
    }

    if (doitParler && nouvelleValeur <= 160) {
        enchereMax = nouvelleValeur; couleurChoisie = nouvelleCouleur; preneur = idJoueur; passeursConsecutifs = 0;
        historiqueEncheres[idJoueur] = `${nouvelleValeur} ${getSymbole(couleurChoisie)}`;
        afficherToast(`${joueurs[idJoueur].nom} annonce ${nouvelleValeur} au ${getSymbole(couleurChoisie)}`);
        mettreAJourTableauEncheres();
        setTimeout(() => { tourActuel = (tourActuel + 1) % 4; afficherOptionsEncheres(tourActuel); }, 800);
    } else {
        historiqueEncheres[idJoueur] = "Passe"; passeursConsecutifs++;
        afficherToast(`${joueurs[idJoueur].nom} passe.`); mettreAJourTableauEncheres();
        setTimeout(() => { tourActuel = (tourActuel + 1) % 4; afficherOptionsEncheres(tourActuel); }, 800);
    }
}

// --- FONCTION CORRIGÉE POUR LE BADGE GÉANT ---
function finirEncheres() {
    document.getElementById('modal-encheres').style.display = 'none';
    atoutActuel = couleurChoisie; 
    contratValeur = enchereMax;
    
    afficherAtoutGeant(atoutActuel); // <--- LIGNE AJOUTÉE ICI
    
    document.getElementById('affichage-contrat').textContent = `Contrat : ${contratValeur} au ${getSymbole(atoutActuel)}`;
    document.getElementById('affichage-preneur').textContent = `Preneur : ${joueurs[preneur].nom}`;
    afficherToast(`Contrat : ${contratValeur} au ${getSymbole(atoutActuel)} par ${joueurs[preneur].nom}`);
    document.getElementById('btn-annonces').style.display = 'block';
    demarrerJeu(preneur);
}

// ==========================================
// ANNONCES (Tierce, 50, 100)
// ==========================================
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
    let res = detecterAnnonces(joueurs[0].main, atoutActuel);
    if (res.points > 0) {
        scores[joueurs[0].equipe] += res.points; mettreAJourInfos();
        afficherToast(`Annonces :<br>${res.messages}`);
        aAnnonce = true; document.getElementById('btn-annonces').style.display = 'none';
    } else {
        afficherToast("Aucune annonce (Tierce/50/100) !");
    }
}

// ==========================================
// JEU
// ==========================================
function getSymbole(couleur) {
    if (couleur === 'coeur') return '♥'; if (couleur === 'carreau') return '♦';
    if (couleur === 'trefle') return '♣'; return '♠';
}

function getImageCarte(carte) {
    let valAnglaise = { 'as': 'ace', 'valet': 'jack', 'dame': 'queen', 'roi': 'king' }[carte.valeur] || carte.valeur;
    let coulAnglaise = { 'coeur': 'hearts', 'carreau': 'diamonds', 'trefle': 'clubs', 'pique': 'spades' }[carte.couleur];
    return `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`;
}

function afficherMain() {
    const conteneur = document.getElementById('main-coinche'); conteneur.innerHTML = "";
    joueurs[0].main.forEach((carte, index) => {
        if (!carte) return;
        const img = document.createElement('img'); img.src = getImageCarte(carte); img.className = "carte-coinche";
        img.onclick = () => jouerCarte(0, index); conteneur.appendChild(img);
    });
}

function afficherMainReseau(maMain) {
    const conteneur = document.getElementById('main-coinche'); conteneur.innerHTML = "";
    maMain.forEach((carte, index) => {
        if (!carte) return;
        const img = document.createElement('img'); img.src = getImageCarte(carte); img.className = "carte-coinche";
        img.onclick = () => jouerCarteReseau(monSiege, index); conteneur.appendChild(img);
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
    document.getElementById('score-eq1').textContent = scores[1]; document.getElementById('score-eq2').textContent = scores[2];
    if (joueurs.length === 4) {
        document.getElementById('nom-j2').textContent = joueurs[2].nom; document.getElementById('nom-j1').textContent = joueurs[1].nom;
        document.getElementById('nom-j3').textContent = joueurs[3].nom;
        document.getElementById('nom-j2').className = `badge-joueur ${tourActuel === 2 ? 'actif' : ''}`;
        document.getElementById('nom-j1').className = `badge-joueur ${tourActuel === 1 ? 'actif' : ''}`;
        document.getElementById('nom-j3').className = `badge-joueur ${tourActuel === 3 ? 'actif' : ''}`;
    }
}

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

function demarrerJeu(premierJoueur) {
    tourActuel = premierJoueur; mettreAJourInfos();
    if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800);
}

function jouerCarte(idJoueur, indexCarte) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(idJoueur, indexCarte, joueurs[idJoueur].main, couleurDemandee)) return;

    let carteJouee = joueurs[idJoueur].main.splice(indexCarte, 1)[0]; if (!carteJouee) return;
    pliEnCours.push({ joueur: idJoueur, carte: carteJouee }); cartesPli.push({ joueur: idJoueur, carte: carteJouee });
    afficherPli(); afficherMain();
    
    if (nombrePli === 0) document.getElementById('btn-annonces').style.display = 'none';
    
    if (pliEnCours.length === 4) { partieBloquee = true; setTimeout(resoudrePli, 1000); }
    else { tourActuel = (tourActuel + 1) % 4; mettreAJourInfos(); if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800); }
}

function jouerCarteReseau(monSiege, indexCarte) {
    if (tourActuel !== monSiege) return afficherToast("Ce n'est pas votre tour !");
    const maMain = joueurs.find(j => j.uid === currentUser.uid).main;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(monSiege, indexCarte, maMain, couleurDemandee)) return afficherToast("Coup invalide !");
    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "actionEnAttente": { joueur: monSiege, indexCarte: indexCarte } });
}

function iaJoue(idJoueur) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    let indexCarte = choisirCarteIA(idJoueur); if (indexCarte !== -1) jouerCarte(idJoueur, indexCarte);
}

function choisirCarteIA(idJoueur) {
    const main = joueurs[idJoueur].main; if (main.length === 0) return -1;
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
    nombrePli++; if (nombrePli === 8) { pointsPli += 10; afficherToast("+10 points (Dix de Der) !"); }

    scores[joueurs[gagnant].equipe] += pointsPli; mettreAJourInfos();
    
    const cartesHTML = document.querySelectorAll('.carte-pli');
    cartesHTML.forEach(img => {
        if (gagnant === 0) img.classList.add('collect', 'pli-bas'); else if (gagnant === 1) img.classList.add('collect', 'pli-gauche');
        else if (gagnant === 2) img.classList.add('collect', 'pli-haut'); else if (gagnant === 3) img.classList.add('collect', 'pli-droite');
    });

    afficherToast(`${joueurs[gagnant].nom} remporte le pli (${pointsPli} pts)`);

    setTimeout(() => {
        pliEnCours = []; cartesPli = []; document.getElementById('zone-pli').innerHTML = "";
        tourActuel = gagnant; mettreAJourInfos(); partieBloquee = false;
        if (joueurs[0].main.length === 0) finDeMancheCoinche();
        else { if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800); }
    }, 1000); 
}

function estPlusForte(carte1, carte2) {
    let ordre = (carte1.couleur === atoutActuel) ? ordreAtout : ordreNormal;
    return ordre.indexOf(carte1.valeur) > ordre.indexOf(carte2.valeur);
}

// ==========================================
// FIN DE PARTIE
// ==========================================
function finDeMancheCoinche() {
    let equipePreneuse = joueurs[preneur].equipe; let equipeDefense = equipePreneuse === 1 ? 2 : 1;
    let pointsPreneur = scores[equipePreneuse];
    
    if (pointsPreneur >= contratValeur) { afficherToast(`✅ CONTRAT RÉUSSI !`); }
    else {
        afficherToast(`❌ CONTRAT ÉCHOUÉ (Dedans) !`);
        scores[equipeDefense] += (160 + contratValeur); scores[equipePreneuse] = 0; 
    }
    
    if (scores[1] >= 3000 || scores[2] >= 3000) {
        let equipeGagnante = scores[1] >= 3000 ? "Nous (Vous & Partenaire)" : "Eux (Adversaires)";
        afficherToast(`FIN DE LA PARTIE !<br>${equipeGagnante} remporte la partie avec ${Math.max(scores[1], scores[2])} points !`);
        setTimeout(() => {
            if (confirm("Voulez-vous rejouer une partie ?")) { scores = { 1: 0, 2: 0 }; lancerCoinche(); }
            else window.location.href = "index.html";
        }, 3000);
    } else {
        setTimeout(() => { lancerCoinche(); }, 2000);
    }
}

// ==========================================
// UI ATOUT GEANT
// ==========================================
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
