// ==========================================
// LOGIQUE DE LA COINCHE (V2 - Multijoueur)
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
let enchereMax = 0;
let atoutChoisi = null;
let niveauDifficulteCoinche = 'facile';

// Variables Réseau
let currentUser = null;
let currentRoomId = null;
let isHost = false;
let unsubscribeRoom = null;
let joueursEnLigne = [];
let modeEnLigne = false;
let monSiege = 0;
let suitSelectionnee = null;

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

// ==========================================
// CRÉATION ET REJOINTURE DE SALON
// ==========================================
async function creerSalonCoinche() {
    if (!currentUser) return alert("Connexion en cours...");
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
        await window.firebase.setDoc(window.firebase.doc(window.firebase.db, "rooms", roomId), {
            host: currentUser.uid,
            jeu: "coinche",
            status: "waiting",
            joueurs: [{ uid: currentUser.uid, nom: "Joueur 1 (Hôte)", seat: 0 }]
        });
        
        currentRoomId = roomId;
        isHost = true;
        monSiege = 0;
        modeEnLigne = true;
        
        document.getElementById('ecran-accueil').style.display = 'none';
        document.getElementById('ecran-attente').style.display = 'flex';
        document.getElementById('code-salon-affiche').textContent = roomId;
        
        ecouterSalonCoinche(roomId);
    } catch (e) { console.error(e); alert("Erreur de création"); }
}

async function rejoindreSalonCoinche() {
    if (!currentUser) return alert("Connexion en cours...");
    const roomId = document.getElementById('input-salon').value.trim().toUpperCase();
    if (roomId.length !== 6) return alert("Code invalide");

    const roomRef = window.firebase.doc(window.firebase.db, "rooms", roomId);
    
    try {
        const docSnap = await window.firebase.getDoc(roomRef);
        if (!docSnap.exists()) return alert("Salon introuvable !");
        
        let data = docSnap.data();
        if (data.joueurs.length >= 4) return alert("Salon complet !");
        if (data.joueurs.some(j => j.uid === currentUser.uid)) return alert("Vous êtes déjà dans ce salon !");
        
        const nouveauSiege = data.joueurs.length;
        const nouveauJoueur = { uid: currentUser.uid, nom: `Joueur ${nouveauSiege + 1}`, seat: nouveauSiege };
        
        await window.firebase.updateDoc(roomRef, {
            joueurs: window.firebase.arrayUnion(nouveauJoueur)
        });
        
        currentRoomId = roomId;
        isHost = false;
        monSiege = nouveauSiege;
        modeEnLigne = true;
        
        document.getElementById('ecran-accueil').style.display = 'none';
        document.getElementById('ecran-attente').style.display = 'flex';
        document.getElementById('code-salon-affiche').textContent = roomId;
        
        ecouterSalonCoinche(roomId);
    } catch (e) { console.error(e); alert("Erreur pour rejoindre"); }
}

function ecouterSalonCoinche(roomId) {
    if (unsubscribeRoom) unsubscribeRoom();
    
    unsubscribeRoom = window.firebase.onSnapshot(window.firebase.doc(window.firebase.db, "rooms", roomId), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            joueursEnLigne = data.joueurs || [];
            
            // UI Salle d'attente
            const listeDiv = document.getElementById('liste-joueurs-salon');
            if(listeDiv) {
                listeDiv.innerHTML = "";
                for (let i = 0; i < 4; i++) {
                    const j = joueursEnLigne.find(p => p.seat === i);
                    if (j) listeDiv.innerHTML += `<div>✅ Joueur ${i+1} : ${j.nom}</div>`;
                    else listeDiv.innerHTML += `<div style="color:gray">⏳ En attente (Place ${i+1})...</div>`;
                }
            }

            if (isHost && document.getElementById('btn-lancer-partie-en-ligne')) {
                document.getElementById('btn-lancer-partie-en-ligne').style.display = 'block';
            }

            // Lancement de la partie
            if (data.status === "playing" && document.getElementById('table-coinche').style.display === 'none') {
                document.getElementById('ecran-attente').style.display = 'none';
                document.getElementById('table-coinche').style.display = 'flex';
            }
            
            // Mise à jour de l'état
            if (data.status === "playing") {
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
        if (j) {
            joueursComplets.push({ id: i, nom: j.nom, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: false, uid: j.uid });
        } else {
            joueursComplets.push({ id: i, nom: `IA (Siège ${i+1})`, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: true, uid: "ia" });
        }
    }

    joueurs = joueursComplets;
    creerDeck();
    distribuer();
    
    // Initialisation du tour d'enchères pour l'hôte
    tourActuel = 0; // L'hôte commence à enchérir
    
    const gameState = {
        status: "playing",
        phase: "encheres",
        tour: tourActuel,
        joueurs: joueurs,
        scores: scores,
        enchereMax: 0,
        atoutActuel: null,
        contratValeur: 0
    };

    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), gameState);
}

function chargerEtatJeuDepuisReseau(data) {
    atoutActuel = data.atoutActuel;
    tourActuel = data.tour;
    joueurs = data.joueurs;
    scores = data.scores;
    enchereMax = data.enchereMax || 0;
    contratValeur = data.contratValeur || 0;

    // Mise à jour UI
    if (atoutActuel) {
        document.getElementById('affichage-atout').innerHTML = `Atout : <span style="font-size:30px; color:${atoutActuel === 'coeur' || atoutActuel === 'carreau' ? 'red' : 'white'};">${getSymbole(atoutActuel)}</span>`;
        document.getElementById('affichage-contrat').textContent = `Contrat : ${contratValeur} au ${getSymbole(atoutActuel)}`;
    }

    let maMain = joueurs.find(j => j.uid === currentUser.uid)?.main || [];
    afficherMainReseau(maMain);
    mettreAJourInfos();

    // Phase d'enchères
    if (data.phase === "encheres") {
        if (tourActuel === monSiege) {
            document.getElementById('modal-encheres').style.display = 'flex';
            document.getElementById('message-enchere').textContent = "C'est à vous de parler !";
        } else {
            document.getElementById('modal-encheres').style.display = 'none';
        }
        
        if (isHost && joueurs[tourActuel].isIA) {
            setTimeout(() => iaEnchereReseau(tourActuel), 1500);
        }
    } else {
        document.getElementById('modal-encheres').style.display = 'none';
    }

    // Action en attente (Coups des joueurs)
    if (isHost && data.actionEnAttente) {
        const action = data.actionEnAttente;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "actionEnAttente": null });
        
        let carteJouee = joueurs[action.joueur].main.splice(action.indexCarte, 1)[0];
        pliEnCours.push({ joueur: action.joueur, carte: carteJouee });
        cartesPli.push({ joueur: action.joueur, carte: carteJouee });
        
        afficherPli();
        tourActuel = (tourActuel + 1) % 4;
        
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
            "joueurs": joueurs,
            "tour": tourActuel
        });

        if (pliEnCours.length === 4) {
            setTimeout(resoudrePliReseau, 1500);
        } else if (joueurs[tourActuel].isIA) {
            setTimeout(() => iaJoueReseau(tourActuel), 1500);
        }
    }

    // L'hôte fait jouer les IA si c'est leur tour
    if (isHost && data.phase === "jeu" && joueurs[tourActuel] && joueurs[tourActuel].isIA) {
        setTimeout(() => iaJoueReseau(tourActuel), 1500);
    }
}

// --- LOGIQUE LOCALE ---
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
    
    creerDeck();
    distribuer();
    lancerEncheres();
}

function creerDeck() {
    deck = [];
    for (let couleur of couleursBelote) {
        for (let valeur of valeursBelote) {
            deck.push({ valeur, couleur });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function distribuer() {
    joueurs.forEach(j => j.main = []);
    for (let i = 0; i < 3; i++) joueurs.forEach(j => j.main.push(deck.pop()));
    deck.pop(); deck.pop(); 
    for (let i = 0; i < 5; i++) joueurs.forEach(j => j.main.push(deck.pop()));
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

// --- ENCHERES ---
function lancerEncheres() {
    document.getElementById('modal-encheres').style.display = 'flex';
    document.getElementById('message-enchere').textContent = "C'est à vous !";
    document.getElementById('zone-coinche').style.display = 'none';
    genererBoutonsValeurs();
    suitSelectionnee = null;
    enchereMax = 0;
}

function genererBoutonsValeurs() {
    const container = document.getElementById('choix-valeur');
    container.innerHTML = "";
    for (let val = 80; val <= 160; val += 10) {
        const btn = document.createElement('button');
        btn.className = "btn-valeur";
        btn.textContent = val;
        btn.onclick = () => validerEnchere(val);
        container.appendChild(btn);
    }
}

function selectionnerAtout(couleur, btn) {
    document.querySelectorAll('.btn-suit').forEach(b => b.style.outline = 'none');
    btn.style.outline = '3px solid #f1c40f';
    suitSelectionnee = couleur;
    atoutChoisi = couleur;
}

function validerEnchere(valeur) {
    if (!suitSelectionnee) return alert("Choisissez d'abord un atout !");
    if (valeur <= enchereMax) return alert("Il faut annoncer plus haut !");

    enchereMax = valeur;
    preneur = 0;
    atoutActuel = suitSelectionnee;
    contratValeur = valeur;
    
    document.getElementById('affichage-contrat').textContent = `Contrat : ${contratValeur} au ${getSymbole(atoutActuel)}`;
    document.getElementById('affichage-preneur').textContent = "Preneur : Vous";
    document.getElementById('modal-encheres').style.display = 'none';
    
    trierMains();
    demarrerJeu(0);
}

function passerEnchere() {
    document.getElementById('modal-encheres').style.display = 'none';
    iaEnchere(1);
}

function iaEnchere(idJoueur) {
    if (idJoueur > 3) {
        if (preneur === -1) {
            alert("Tout le monde a passé ! On redistribue.");
            return lancerCoinche();
        }
        atoutActuel = atoutChoisi;
        trierMains();
        return demarrerJeu(preneur);
    }

    const main = joueurs[idJoueur].main;
    let meilleurAtout = null;
    let meilleurScore = 0;

    couleursBelote.forEach(couleur => {
        let score = 0;
        main.forEach(c => {
            if (c.couleur === couleur) { score += 2; if (c.valeur === 'valet') score += 5; if (c.valeur === '9') score += 4; }
            else { if (c.valeur === 'as') score += 2; if (c.valeur === '10') score += 1; }
        });
        if (score > meilleurScore) { meilleurScore = score; meilleurAtout = couleur; }
    });

    if (meilleurScore >= 12 && enchereMax < 100) {
        enchereMax += 10;
        preneur = idJoueur;
        atoutChoisi = meilleurAtout;
        contratValeur = enchereMax;
        document.getElementById('affichage-contrat').textContent = `Contrat : ${contratValeur} au ${getSymbole(atoutActuel)}`;
        document.getElementById('affichage-preneur').textContent = `Preneur : IA ${idJoueur}`;
        proposerCoinche(idJoueur);
    } else {
        setTimeout(() => iaEnchere(idJoueur + 1), 500);
    }
}

function proposerCoinche(idIA) {
    document.getElementById('modal-encheres').style.display = 'flex';
    document.getElementById('message-enchere').textContent = `L'IA ${idIA} a annoncé ${contratValeur} au ${getSymbole(atoutChoisi)}`;
    document.getElementById('choix-atout').style.display = 'none';
    document.getElementById('choix-valeur').style.display = 'none';
    document.getElementById('zone-coinche').style.display = 'block';
    document.querySelector('.btn-passer').textContent = "Passer (Laisser jouer)";
}

function coincher() {
    coinche = true;
    document.getElementById('modal-encheres').style.display = 'none';
    document.getElementById('affichage-contrat').textContent += " (COINCHÉ !)";
    document.getElementById('affichage-contrat').style.color = "#e74c3c";
    atoutActuel = atoutChoisi;
    trierMains();
    demarrerJeu(preneur);
}

function demarrerJeu(premierJoueur) {
    document.getElementById('choix-atout').style.display = 'flex';
    document.getElementById('choix-valeur').style.display = 'flex';
    document.querySelector('.btn-passer').textContent = "Passer";
    
    atoutActuel = atoutChoisi;
    document.getElementById('affichage-contrat').textContent = `Contrat : ${contratValeur} au ${getSymbole(atoutActuel)} ${coinche ? '(COINCHÉ)' : ''}`;
    document.getElementById('affichage-contrat').style.color = coinche ? "#e74c3c" : "#f1c40f";
    
    tourActuel = premierJoueur;
    mettreAJourInfos();
    
    if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 1000);
}

// --- JEU ---
function getSymbole(couleur) {
    if (couleur === 'coeur') return '♥';
    if (couleur === 'carreau') return '♦';
    if (couleur === 'trefle') return '♣';
    return '♠';
}

function getImageCarte(carte) {
    let valAnglaise = { 'as': 'ace', 'valet': 'jack', 'dame': 'queen', 'roi': 'king' }[carte.valeur] || carte.valeur;
    let coulAnglaise = { 'coeur': 'hearts', 'carreau': 'diamonds', 'trefle': 'clubs', 'pique': 'spades' }[carte.couleur];
    return `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`;
}

function afficherMain() {
    const conteneur = document.getElementById('main-coinche');
    conteneur.innerHTML = "";
    joueurs[0].main.forEach((carte, index) => {
        const img = document.createElement('img');
        img.src = getImageCarte(carte);
        img.className = "carte-coinche";
        img.onclick = () => {
            if (modeEnLigne) jouerCarteReseau(monSiege, index);
            else jouerCarte(0, index);
        };
        conteneur.appendChild(img);
    });
}

function afficherMainReseau(maMain) {
    const conteneur = document.getElementById('main-coinche');
    conteneur.innerHTML = "";
    maMain.forEach((carte, index) => {
        const img = document.createElement('img');
        img.src = getImageCarte(carte);
        img.className = "carte-coinche";
        img.onclick = () => jouerCarteReseau(monSiege, index);
        conteneur.appendChild(img);
    });
}

function afficherPli() {
    const zone = document.getElementById('zone-pli');
    zone.innerHTML = "";
    cartesPli.forEach((item) => {
        const img = document.createElement('img');
        img.src = getImageCarte(item.carte);
        img.className = "carte-pli";
        if (item.joueur === 0) img.classList.add('pli-bas');
        else if (item.joueur === 1) img.classList.add('pli-gauche');
        else if (item.joueur === 2) img.classList.add('pli-haut');
        else if (item.joueur === 3) img.classList.add('pli-droite');
        zone.appendChild(img);
    });
}

function mettreAJourInfos() {
    document.getElementById('score-eq1').textContent = scores[1];
    document.getElementById('score-eq2').textContent = scores[2];
    
    if (joueurs.length === 4) {
        document.getElementById('nom-j2').textContent = joueurs[2].nom;
        document.getElementById('nom-j1').textContent = joueurs[1].nom;
        document.getElementById('nom-j3').textContent = joueurs[3].nom;
        
        document.getElementById('nom-j2').className = `badge-joueur ${tourActuel === 2 ? 'actif' : ''}`;
        document.getElementById('nom-j1').className = `badge-joueur ${tourActuel === 1 ? 'actif' : ''}`;
        document.getElementById('nom-j3').className = `badge-joueur ${tourActuel === 3 ? 'actif' : ''}`;
    }
}

function estCoupValide(idJoueur, indexCarte, cartesMain, couleurDemandee) {
    if (!couleurDemandee) return true;
    const carte = cartesMain[indexCarte];
    const aCouleur = cartesMain.some(c => c.couleur === couleurDemandee);

    if (aCouleur && carte.couleur !== couleurDemandee) {
        if (!modeEnLigne) alert(`Vous devez fournir du ${couleurDemandee} !`);
        return false;
    }
    if (!aCouleur && carte.couleur !== atoutActuel) {
        const aAtout = cartesMain.some(c => c.couleur === atoutActuel);
        if (aAtout) {
            if (!modeEnLigne) alert(`Vous n'avez pas la couleur, vous devez couper à l'atout !`);
            return false;
        }
    }
    return true;
}

function jouerCarte(idJoueur, indexCarte) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(idJoueur, indexCarte, joueurs[idJoueur].main, couleurDemandee)) return;

    let carteJouee = joueurs[idJoueur].main.splice(indexCarte, 1)[0];
    pliEnCours.push({ joueur: idJoueur, carte: carteJouee });
    cartesPli.push({ joueur: idJoueur, carte: carteJouee });
    
    afficherPli();
    afficherMain();
    
    if (pliEnCours.length === 4) {
        partieBloquee = true;
        setTimeout(resoudrePli, 1000);
    } else {
        tourActuel = (tourActuel + 1) % 4;
        mettreAJourInfos();
        if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 1000);
    }
}

function jouerCarteReseau(monSiege, indexCarte) {
    if (tourActuel !== monSiege) return alert("Ce n'est pas votre tour !");

    const maMain = joueurs.find(j => j.uid === currentUser.uid).main;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    
    if (!estCoupValide(monSiege, indexCarte, maMain, couleurDemandee)) {
        return alert("Coup invalide !");
    }

    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
        "actionEnAttente": { joueur: monSiege, indexCarte: indexCarte }
    });
}

function iaJoue(idJoueur) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    let indexCarte = choisirCarteIA(idJoueur);
    if (indexCarte !== -1) jouerCarte(idJoueur, indexCarte);
}

function iaJoueReseau(idJoueur) {
    if (!isHost || tourActuel !== idJoueur || partieBloquee) return;
    let indexCarte = choisirCarteIA(idJoueur);
    if (indexCarte !== -1) {
        let carteJouee = joueurs[idJoueur].main.splice(indexCarte, 1)[0];
        pliEnCours.push({ joueur: idJoueur, carte: carteJouee });
        cartesPli.push({ joueur: idJoueur, carte: carteJouee });
        afficherPli();
        
        tourActuel = (tourActuel + 1) % 4;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
            "joueurs": joueurs,
            "tour": tourActuel
        });
        
        if (pliEnCours.length === 4) setTimeout(resoudrePliReseau, 1500);
        else if (joueurs[tourActuel].isIA) setTimeout(() => iaJoueReseau(tourActuel), 1500);
    }
}

function choisirCarteIA(idJoueur) {
    const main = joueurs[idJoueur].main;
    if (main.length === 0) return -1;

    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    let indexCarte = 0;

    if (couleurDemandee) {
        let cartesMemeCouleur = main.map((c, i) => c.couleur === couleurDemandee ? i : -1).filter(i => i !== -1);
        if (cartesMemeCouleur.length > 0) indexCarte = cartesMemeCouleur[0];
        else {
            let cartesAtout = main.map((c, i) => c.couleur === atoutActuel ? i : -1).filter(i => i !== -1);
            if (cartesAtout.length > 0) indexCarte = cartesAtout[0];
        }
    }
    return indexCarte;
}

function resoudrePli() {
    const couleurDemandee = pliEnCours[0].carte.couleur;
    let gagnant = pliEnCours[0].joueur;
    let carteGagnante = pliEnCours[0].carte;

    for (let i = 1; i < 4; i++) {
        const joueur = pliEnCours[i].joueur;
        const carte = pliEnCours[i].carte;
        if (carte.couleur === atoutActuel && carteGagnante.couleur !== atoutActuel) { gagnant = joueur; carteGagnante = carte; }
        else if (carte.couleur === couleurDemandee && carteGagnante.couleur === couleurDemandee) { if (estPlusForte(carte, carteGagnante)) { gagnant = joueur; carteGagnante = carte; } }
        else if (carte.couleur === atoutActuel && carteGagnante.couleur === atoutActuel) { if (estPlusForte(carte, carteGagnante)) { gagnant = joueur; carteGagnante = carte; } }
    }

    let pointsPli = pliEnCours.reduce((sum, item) => sum + pointsBelote[item.carte.valeur], 0);
    nombrePli++;
    if (nombrePli === 8) pointsPli += 10;

    let equipeGagnante = joueurs[gagnant].equipe;
    scores[equipeGagnante] += pointsPli;
    mettreAJourInfos();
    
    setTimeout(() => {
        pliEnCours = []; cartesPli = [];
        document.getElementById('zone-pli').innerHTML = "";
        tourActuel = gagnant;
        mettreAJourInfos();
        partieBloquee = false;
        
        if (joueurs[0].main.length === 0) finDeMancheCoinche();
        else if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 1000);
    }, 1500);
}

function resoudrePliReseau() {
    const couleurDemandee = pliEnCours[0].carte.couleur;
    let gagnant = pliEnCours[0].joueur;
    let carteGagnante = pliEnCours[0].carte;

    for (let i = 1; i < 4; i++) {
        const joueur = pliEnCours[i].joueur;
        const carte = pliEnCours[i].carte;
        if (carte.couleur === atoutActuel && carteGagnante.couleur !== atoutActuel) { gagnant = joueur; carteGagnante = carte; }
        else if (carte.couleur === couleurDemandee && carteGagnante.couleur === couleurDemandee) { if (estPlusForte(carte, carteGagnante)) { gagnant = joueur; carteGagnante = carte; } }
        else if (carte.couleur === atoutActuel && carteGagnante.couleur === atoutActuel) { if (estPlusForte(carte, carteGagnante)) { gagnant = joueur; carteGagnante = carte; } }
    }

    let pointsPli = pliEnCours.reduce((sum, item) => sum + pointsBelote[item.carte.valeur], 0);
    nombrePli++;
    if (nombrePli === 8) pointsPli += 10;

    let equipeGagnante = joueurs[gagnant].equipe;
    scores[equipeGagnante] += pointsPli;
    
    pliEnCours = []; cartesPli = [];
    document.getElementById('zone-pli').innerHTML = "";
    tourActuel = gagnant;

    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
        "joueurs": joueurs,
        "scores": scores,
        "tour": tourActuel
    });

    if (joueurs[0].main.length === 0) {
        finDeMancheCoincheReseau();
    } else if (joueurs[tourActuel].isIA) {
        setTimeout(() => iaJoueReseau(tourActuel), 1500);
    }
}

function estPlusForte(carte1, carte2) {
    let ordre = (carte1.couleur === atoutActuel) ? ordreAtout : ordreNormal;
    return ordre.indexOf(carte1.valeur) > ordre.indexOf(carte2.valeur);
}

function finDeMancheCoinche() {
    // Logique locale
    alert(`Fin de la manche !`);
    window.location.reload();
}

function finDeMancheCoincheReseau() {
    // Logique réseau (gérée par l'hôte)
    let equipePreneuse = joueurs[preneur].equipe;
    let equipeDefense = equipePreneuse === 1 ? 2 : 1;
    let pointsPreneur = scores[equipePreneuse];
    let pointsDefense = scores[equipeDefense];
    let messageFin = `CONTRAT ${pointsPreneur >= contratValeur ? "RÉUSSI" : "ÉCHOUÉ"}\nScores : Nous ${pointsPreneur} - Eux ${pointsDefense}`;
    
    alert(messageFin);
    window.location.reload();
}