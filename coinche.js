// ==========================================
// LOGIQUE DE LA COINCHE (V15 - Sons & Règles Officielles)
// ==========================================

const couleursBelote = ['coeur', 'carreau', 'trefle', 'pique'];
const valeursBelote = ['7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];
const pointsBelote = { 'as': 11, '10': 10, 'roi': 4, 'dame': 3, 'valet': 2, '9': 0, '8': 0, '7': 0 };
const ordreAtout = ['7', '8', 'dame', 'roi', '10', 'as', '9', 'valet'];
const ordreNormal = ['7', '8', '9', 'valet', 'dame', 'roi', '10', 'as'];
const ordreSuite = ['7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];

let deck = [];
let joueurs = [];
let atoutActuel = null;
let tourActuel = 0;
let pliEnCours = [];
let cartesPli = [];
let scores = { 1: 0, 2: 0 };
let scoresManche = { 1: 0, 2: 0 };
let nombrePli = 0;
let partieBloquee = false; 
let preneur = -1;
let donneur = 0; // NOUVEAU : Le donneur tourne
let contratValeur = 0;
let coinche = false;
let niveauDifficulteCoinche = 'facile';

let enchereMax = 0;
let couleurChoisie = null;
let passeursConsecutifs = 0;
let historiqueEncheres = ["-", "-", "-", "-"]; 
let aAnnonce = false; 
let estMuet = false;

// SONS
const sonPiocher = new Audio('audio/pioche.ogg');
const sonPoser = new Audio('audio/pose.ogg');
const sonVictoire = new Audio('audio/victoire.ogg');
const sonDefaite = new Audio('audio/defaite.ogg');

function jouerSon(sound) {
    if (estMuet) return;
    sound.currentTime = 0;
    sound.volume = 0.3;
    sound.play().catch(e => console.log("Son bloqué"));
}

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
// RÉSEAU (Firebase)
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
        if(carteJouee) { 
            jouerSon(sonPoser);
            pliEnCours.push({ joueur: action.joueur, carte: carteJouee }); cartesPli.push({ joueur: action.joueur, carte: carteJouee }); 
        }
        afficherPli(); tourActuel = (tourActuel + 1) % 4;
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "joueurs": joueurs, "tour": tourActuel });
        if (joueurs[tourActuel].isIA) setTimeout(() => iaJoue(tourActuel), 800);
        if (pliEnCours.length === 4) setTimeout(resoudrePli, 1500);
    }
    
    if(atoutActuel && preneur !== -1) afficherAtoutSurJoueur();
    
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
// LOGIQUE LOCALE (V16 - Règles corrigées)
// ==========================================

// Détail des points de la manche EN COURS (remis à zéro à chaque manche)
let detailManche = { plis: { 1: 0, 2: 0 }, belote: { 1: 0, 2: 0 }, annonces: { 1: 0, 2: 0 } };
let plisGagnes = { 1: 0, 2: 0 };
let plisParJoueur = [0, 0, 0, 0];

function totalManche(eq) {
    return detailManche.plis[eq] + detailManche.belote[eq] + detailManche.annonces[eq];
}

function lancerCoinche() {
    document.getElementById('ecran-accueil').style.display = 'none';
    document.getElementById('table-coinche').style.display = 'flex';
    modeEnLigne = false;

    // --- REMISE À ZÉRO COMPLÈTE DE LA MANCHE ---
    detailManche = { plis: { 1: 0, 2: 0 }, belote: { 1: 0, 2: 0 }, annonces: { 1: 0, 2: 0 } };
    plisGagnes = { 1: 0, 2: 0 };
    plisParJoueur = [0, 0, 0, 0];
    nombrePli = 0;
    pliEnCours = [];
    cartesPli = [];
    atoutActuel = null;
    preneur = -1;
    contratValeur = 0;
    atoutSelectionneEnchere = null;
    partieBloquee = true;
    aAnnonce = false;
    document.getElementById('zone-pli').innerHTML = "";
    document.getElementById('affichage-contrat').textContent = "Contrat : En attente";
    document.getElementById('affichage-preneur').textContent = "Preneur : -";
    cacherBadgeAtout();

    joueurs = [
        { id: 0, nom: "Vous", main: [], equipe: 1, isIA: false, aBelote: false, beloteJouees: 0 },
        { id: 1, nom: "Gauche", main: [], equipe: 2, isIA: true, aBelote: false, beloteJouees: 0 },
        { id: 2, nom: "Partenaire", main: [], equipe: 1, isIA: true, aBelote: false, beloteJouees: 0 },
        { id: 3, nom: "Droite", main: [], equipe: 2, isIA: true, aBelote: false, beloteJouees: 0 }
    ];

    donneur = (donneur + 1) % 4;
    afficherToast(`C'est ${joueurs[donneur].nom} qui distribue.`);

    creerDeck(); distribuer();

    tourActuel = (donneur + 1) % 4;
    mettreAJourInfos();
    demarrerEncheres();
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
// ENCHERES
// ==========================================
function demarrerEncheres() {
    document.getElementById('modal-encheres').style.display = 'flex';
    document.getElementById('zone-coinche').style.display = 'none';
    enchereMax = 0; couleurChoisie = null; passeursConsecutifs = 0; historiqueEncheres = ["-", "-", "-", "-"];
    preneur = -1;
    atoutSelectionneEnchere = null;
    document.querySelectorAll('.btn-couleur').forEach(b => b.style.outline = 'none');
    mettreAJourTableauEncheres(); afficherOptionsEncheres(tourActuel);
}

function mettreAJourTableauEncheres() {
    for (let i = 0; i < 4; i++) {
        document.getElementById(`hist-j${i}`).innerHTML = `<strong>${joueurs[i].nom}</strong>${historiqueEncheres[i]}`;
        document.getElementById(`hist-j${i}`).className = `annonce-joueur ${tourActuel === i ? 'actif' : ''}`;
    }
}

function afficherOptionsEncheres(idJoueur) {
    mettreAJourTableauEncheres();
    if (passeursConsecutifs >= 3 && enchereMax > 0) { finirEncheres(); return; }
    if (passeursConsecutifs >= 4 && enchereMax === 0) {
        document.getElementById('modal-encheres').style.display = 'none';
        afficherToast("Tout le monde a passé ! Redistribution.");
        return setTimeout(lancerCoinche, 1500);
    }

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
        }
        if (enchereMax < 500) {
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
    tourActuel = (tourActuel + 1) % 4; afficherOptionsEncheres(tourActuel);
}

function evaluerMain(main) {
    let evalScores = { coeur: 0, carreau: 0, trefle: 0, pique: 0 }; let basePoints = 0;
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

function aBeloteEnMain(main) {
    return main.some(c => c && c.couleur === atoutActuel && c.valeur === 'roi')
        && main.some(c => c && c.couleur === atoutActuel && c.valeur === 'dame');
}

function finirEncheres() {
    document.getElementById('modal-encheres').style.display = 'none';
    atoutActuel = couleurChoisie;
    contratValeur = enchereMax;
    partieBloquee = true; // bloqué le temps des annonces

    afficherAtoutSurJoueur();
    afficherBadgeAtout(`${contratValeur} · ${joueurs[preneur].nom}`);

    document.getElementById('affichage-contrat').textContent = `Contrat : ${contratValeur} au ${getSymbole(atoutActuel)}`;
    document.getElementById('affichage-preneur').textContent = `Preneur : ${joueurs[preneur].nom}`;
    afficherToast(`Contrat : ${contratValeur} au ${getSymbole(atoutActuel)} par ${joueurs[preneur].nom}`);
    jouerSon(sonPoser);

    joueurs.forEach(j => {
        // Belote-Rebelote : valable pour TOUS les joueurs
        j.aBelote = aBeloteEnMain(j.main);
        j.beloteJouees = 0;
        if (j.isIA) {
            let res = detecterAnnonces(j.main, atoutActuel);
            if (res.points > 0) {
                detailManche.annonces[j.equipe] += res.points;
                afficherToast(`${j.nom} annonce :<br>${res.messages}`);
            }
        }
    });
    if (joueurs[0].aBelote) afficherToast(`Vous avez Belote-Rebelote !<br>Jouez le Roi et la Dame d'atout (+20 pts)`);
    mettreAJourInfos();

    document.getElementById('btn-annonces').style.display = 'block';

    // Le jeu commence par le joueur à gauche du donneur
    tourActuel = (donneur + 1) % 4;
    setTimeout(() => {
        partieBloquee = false;
        demarrerJeu(tourActuel);
    }, 3000);
}

// ==========================================
// ANNONCES (Tierce / Cinquante / Cent) - TOUTES les couleurs, atout compris
// ==========================================
function detecterAnnonces(main, atout) {
    let pointsAnnonces = 0; let messages = [];
    let cartesParCouleur = { coeur: [], carreau: [], trefle: [], pique: [] };
    main.forEach(c => { if (c) cartesParCouleur[c.couleur].push(c.valeur); });

    for (let coul in cartesParCouleur) {
        let cartes = cartesParCouleur[coul];
        if (cartes.length < 3) continue;
        cartes.sort((a, b) => ordreSuite.indexOf(a) - ordreSuite.indexOf(b));
        let maxSuite = 1; let suiteActuelle = 1;

        for (let i = 0; i < cartes.length - 1; i++) {
            let idxActuel = ordreSuite.indexOf(cartes[i]);
            let idxSuivant = ordreSuite.indexOf(cartes[i + 1]);
            if (idxSuivant === idxActuel + 1) {
                suiteActuelle++;
                if (suiteActuelle > maxSuite) maxSuite = suiteActuelle;
            } else { suiteActuelle = 1; }
        }

        if (maxSuite >= 3) {
            let pts = 0; let nom = "";
            if (maxSuite === 3) { pts = 20; nom = "Tierce"; }
            else if (maxSuite === 4) { pts = 50; nom = "Cinquante"; }
            else { pts = 100; nom = "Cent"; }
            pointsAnnonces += pts; messages.push(`${nom} au ${getSymbole(coul)} (${pts} pts)`);
        }
    }
    return { points: pointsAnnonces, messages: messages.join('<br>') };
}

function annoncerPoints() {
    if (aAnnonce) return;
    let res = detecterAnnonces(joueurs[0].main, atoutActuel);
    if (res.points > 0) {
        detailManche.annonces[joueurs[0].equipe] += res.points;
        mettreAJourInfos();
        afficherToast(`Annonces :<br>${res.messages}`);
        aAnnonce = true; document.getElementById('btn-annonces').style.display = 'none';
        jouerSon(sonVictoire);
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
    const main = joueurs[0].main;
    // (Plus d'aide visuelle : aucune carte n'est mise en surbrillance ni grisée)
    const monTour = !modeEnLigne && !partieBloquee && tourActuel === 0 && !!atoutActuel && pliEnCours.length < 4;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    majIndicateurTour(monTour);
    main.forEach((carte, index) => {
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
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('score-eq1', scores[1]);            // total de la partie
    set('score-eq2', scores[2]);
    set('manche-eq1', totalManche(1));      // points de la manche en cours
    set('manche-eq2', totalManche(2));
    if (joueurs.length === 4) {
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`nom-j${i}`);
            if (el) el.className = `badge-joueur ${tourActuel === i ? 'actif' : ''}`;
        }
        afficherAdversaires();
        if (joueurs[0].main) afficherMain();
    }
}

// Qui est actuellement maître du pli (couleur demandée / atout, bien comparé)
function trouverMaitrePli(pli) {
    const couleurDemandee = pli[0].carte.couleur;
    let meilleur = pli[0];
    for (let i = 1; i < pli.length; i++) {
        const c = pli[i].carte;
        const m = meilleur.carte;
        if (c.couleur === atoutActuel && m.couleur !== atoutActuel) {
            meilleur = pli[i];
        } else if (c.couleur === m.couleur && (c.couleur === atoutActuel || c.couleur === couleurDemandee)) {
            const ordre = (c.couleur === atoutActuel) ? ordreAtout : ordreNormal;
            if (ordre.indexOf(c.valeur) > ordre.indexOf(m.valeur)) meilleur = pli[i];
        }
    }
    return meilleur;
}

// Règles officielles : fournir > (monter à l'atout) ; sinon couper sauf si le partenaire est maître
function estCoupValide(idJoueur, indexCarte, cartesMain, couleurDemandee, silencieux = false) {
    if (!couleurDemandee) return true;
    const carte = cartesMain[indexCarte];
    if (!carte) return false;
    const msg = (t) => { if (!silencieux && !modeEnLigne) afficherToast(t); };

    const aCouleur = cartesMain.some(c => c && c.couleur === couleurDemandee);
    const atoutsMain = cartesMain.filter(c => c && c.couleur === atoutActuel);

    let meilleurAtoutPli = -1;
    pliEnCours.forEach(p => {
        if (p.carte.couleur === atoutActuel) meilleurAtoutPli = Math.max(meilleurAtoutPli, ordreAtout.indexOf(p.carte.valeur));
    });

    if (aCouleur) {
        if (carte.couleur !== couleurDemandee) { msg(`Vous devez fournir du ${couleurDemandee} !`); return false; }
        if (couleurDemandee === atoutActuel) {
            const idx = ordreAtout.indexOf(carte.valeur);
            const aPlusFort = atoutsMain.some(c => ordreAtout.indexOf(c.valeur) > meilleurAtoutPli);
            if (aPlusFort && idx < meilleurAtoutPli) { msg("Vous devez monter à l'atout !"); return false; }
        }
        return true;
    }

    const maitre = trouverMaitrePli(pliEnCours);
    const partenaireMaitre = joueurs[maitre.joueur].equipe === joueurs[idJoueur].equipe;
    if (partenaireMaitre) return true; // le partenaire tient : on joue ce qu'on veut

    if (atoutsMain.length > 0) {
        if (carte.couleur !== atoutActuel) { msg("Vous n'avez pas la couleur : vous devez couper à l'atout !"); return false; }
        const idx = ordreAtout.indexOf(carte.valeur);
        const aPlusFort = atoutsMain.some(c => ordreAtout.indexOf(c.valeur) > meilleurAtoutPli);
        if (aPlusFort && idx < meilleurAtoutPli) { msg("Vous devez surcouper !"); return false; }
    }
    return true;
}

function demarrerJeu(premierJoueur) {
    tourActuel = premierJoueur; mettreAJourInfos();
    afficherMain();
    if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800);
}

function jouerCarte(idJoueur, indexCarte) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    const joueur = joueurs[idJoueur];
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(idJoueur, indexCarte, joueur.main, couleurDemandee)) return;

    let carteJouee = joueur.main.splice(indexCarte, 1)[0];
    if (!carteJouee) return;

    jouerSon(sonPoser);

    // BELOTE / REBELOTE (pour tous les joueurs, +20 pts à son équipe dès la Rebelote)
    if (joueur.aBelote && carteJouee.couleur === atoutActuel && (carteJouee.valeur === 'roi' || carteJouee.valeur === 'dame')) {
        joueur.beloteJouees++;
        if (joueur.beloteJouees === 1) {
            afficherToast(`<strong>${joueur.nom} : BELOTE !</strong>`);
        } else {
            detailManche.belote[joueur.equipe] += 20;
            afficherToast(`<strong>${joueur.nom} : REBELOTE !</strong> (+20 pts)`);
            mettreAJourInfos();
        }
    }

    pliEnCours.push({ joueur: idJoueur, carte: carteJouee });
    cartesPli.push({ joueur: idJoueur, carte: carteJouee });
    afficherPli();
    if (pliEnCours.length === 4) partieBloquee = true;
    afficherMain();

    // Le bouton d'annonce disparaît quand VOUS jouez votre première carte
    if (idJoueur === 0 && nombrePli === 0) document.getElementById('btn-annonces').style.display = 'none';

    if (pliEnCours.length === 4) {
        partieBloquee = true;
        setTimeout(resoudrePli, 1000);
    } else {
        tourActuel = (tourActuel + 1) % 4;
        mettreAJourInfos();
        if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800);
    }
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

// L'IA ne choisit QUE parmi les cartes autorisées
function choisirCarteIA(idJoueur) {
    const main = joueurs[idJoueur].main;
    if (main.length === 0) return -1;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;

    const valides = [];
    main.forEach((c, i) => { if (c && estCoupValide(idJoueur, i, main, couleurDemandee, true)) valides.push(i); });
    if (valides.length === 0) return 0;

    const force = (c) => c.couleur === atoutActuel ? 100 + ordreAtout.indexOf(c.valeur) : ordreNormal.indexOf(c.valeur);

    let partenaireMaitre = false;
    if (pliEnCours.length > 0) {
        const m = trouverMaitrePli(pliEnCours);
        partenaireMaitre = joueurs[m.joueur].equipe === joueurs[idJoueur].equipe;
    }

    if (partenaireMaitre) { // on "charge" le partenaire de points
        valides.sort((a, b) => pointsCarte(main[b]) - pointsCarte(main[a]));
        return valides[0];
    }
    valides.sort((a, b) => force(main[a]) - force(main[b]));
    return pliEnCours.length === 0 ? valides[valides.length - 1] : valides[0];
}

function resoudrePli() {
    const maitre = trouverMaitrePli(pliEnCours);
    const gagnant = maitre.joueur;
    const eq = joueurs[gagnant].equipe;

    let pointsPli = pliEnCours.reduce((sum, item) => sum + pointsCarte(item.carte), 0);
    nombrePli++;
    plisGagnes[eq]++;
    plisParJoueur[gagnant]++;
    if (nombrePli === 8) { pointsPli += 10; afficherToast("+10 points (Dix de Der) !"); }

    detailManche.plis[eq] += pointsPli;
    mettreAJourInfos();
    jouerSon(sonPiocher);

    const cartesHTML = document.querySelectorAll('.carte-pli');
    cartesHTML.forEach(img => {
        if (gagnant === 0) img.classList.add('collect', 'pli-bas'); else if (gagnant === 1) img.classList.add('collect', 'pli-gauche');
        else if (gagnant === 2) img.classList.add('collect', 'pli-haut'); else if (gagnant === 3) img.classList.add('collect', 'pli-droite');
    });

    afficherToast(`${joueurs[gagnant].nom} remporte le pli (${pointsPli} pts)`);

    setTimeout(() => {
        pliEnCours = []; cartesPli = []; document.getElementById('zone-pli').innerHTML = "";
        tourActuel = gagnant; partieBloquee = false; mettreAJourInfos();
        if (joueurs[0].main.length === 0) finDeMancheCoinche();
        else { if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800); }
    }, 1000);
}

function estPlusForte(carte1, carte2) {
    let ordre = (carte1.couleur === atoutActuel) ? ordreAtout : ordreNormal;
    return ordre.indexOf(carte1.valeur) > ordre.indexOf(carte2.valeur);
}

function finDeMancheCoinche() {
    const eqP = joueurs[preneur].equipe;
    const eqD = eqP === 1 ? 2 : 1;

    // Capot : une équipe a fait les 8 plis (+90)
    let capotTxt = "";
    [1, 2].forEach(eq => {
        if (plisGagnes[eq] === 8) { detailManche.plis[eq] += 90; capotTxt = ` · CAPOT (+90)`; }
    });

    // Contrat réussi ? (points de la manche uniquement, plus jamais le cumul des anciennes parties)
    let reussi;
    if (contratValeur === 500) reussi = plisParJoueur[preneur] === 8;        // Générale : le preneur seul fait tout
    else if (contratValeur === 250) reussi = plisGagnes[eqP] === 8;          // Capot
    else reussi = totalManche(eqP) >= contratValeur;

    const ptsP = totalManche(eqP);
    const ptsD = totalManche(eqD);
    let gainP, gainD;
    if (reussi) {
        gainP = ptsP + contratValeur;
        gainD = ptsD;
        jouerSon(eqP === 1 ? sonVictoire : sonDefaite);
    } else {
        gainD = 160 + contratValeur + detailManche.belote[eqD] + detailManche.annonces[eqD];
        gainP = detailManche.belote[eqP]; // la belote reste acquise
        jouerSon(eqP === 1 ? sonDefaite : sonVictoire);
    }
    scores[eqP] += gainP;
    scores[eqD] += gainD;
    mettreAJourInfos();

    const gains = {}; gains[eqP] = gainP; gains[eqD] = gainD;
    const fin = scores[1] >= 3000 || scores[2] >= 3000;
    const nousGagnons = scores[1] >= scores[2];

    afficherFinManche({
        titre: fin ? (nousGagnons ? "🏆 Victoire !" : "Défaite...") : "Fin de la manche",
        sousTitre: `${reussi ? '✅ Contrat réussi' : '❌ Contrat chuté (dedans)'}<br>`
                   + `${contratValeur} ${getSymbole(atoutActuel)} · ${joueurs[preneur].nom}${capotTxt}`
                   + (reussi ? `<br>Le preneur a fait ${ptsP} pts` : `<br>La défense marque ${160 + contratValeur}`)
                   + (fin ? `<br><strong>${nousGagnons ? 'Votre équipe' : "L'équipe adverse"} remporte la partie !</strong>` : ''),
        classe: (eqP === 1) === reussi ? 'ok' : 'ko',
        lignes: [
            ['Plis (dix de der inclus)', detailManche.plis[1], detailManche.plis[2]],
            ['Belote-Rebelote', detailManche.belote[1], detailManche.belote[2]],
            ['Annonces', detailManche.annonces[1], detailManche.annonces[2]],
            ['Points marqués (contrat inclus)', gains[1], gains[2], 'total'],
            ['Total de la partie', scores[1], scores[2], 'grand-total']
        ],
        fin: fin,
        texteBouton: fin ? 'Rejouer' : 'Manche suivante',
        onSuivant: () => { if (fin) scores = { 1: 0, 2: 0 }; lancerCoinche(); }
    });
}

function afficherAtoutSurJoueur() {
    for (let i = 1; i <= 3; i++) {
        let el = document.getElementById(`nom-j${i}`);
        if (el) el.innerHTML = joueurs[i] ? joueurs[i].nom : '';
    }
    if (!atoutActuel || preneur === -1) return;

    let preneurElement = document.getElementById(`nom-j${preneur}`);
    if (preneurElement) {
        let estRouge = (atoutActuel === 'coeur' || atoutActuel === 'carreau');
        let couleur = estRouge ? '#e74c3c' : '#ffffff';
        preneurElement.innerHTML += ` <span style="font-size:22px; color:${couleur}; text-shadow: 1px 1px 2px black; vertical-align: middle;">[${getSymbole(atoutActuel)}]</span>`;
    }
}

// Valeur d'une carte : à l'atout le Valet vaut 20 et le 9 vaut 14
function pointsCarte(c) {
    if (c.couleur === atoutActuel) {
        if (c.valeur === 'valet') return 20;
        if (c.valeur === '9') return 14;
    }
    return pointsBelote[c.valeur];
}
// ==========================================
// AFFICHAGE : adversaires, badge d'atout, fin de manche
// ==========================================
function afficherAdversaires() {
    if (joueurs.length !== 4) return;
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`eventail-j${i}`);
        if (!el) continue;
        const n = joueurs[i].main.length;
        let h = '';
        for (let k = 0; k < n; k++) h += '<div class="dos-carte"></div>';
        h += `<span class="compteur-cartes">${n}</span>`;
        el.innerHTML = h;
    }
}

function afficherBadgeAtout(detail) {
    const b = document.getElementById('badge-atout');
    if (!b || !atoutActuel) return;
    const rouge = (atoutActuel === 'coeur' || atoutActuel === 'carreau');
    const s = document.getElementById('badge-atout-symbole');
    s.textContent = getSymbole(atoutActuel);
    s.className = 'badge-atout-symbole ' + (rouge ? 'rouge' : 'noir');
    document.getElementById('badge-atout-detail').textContent = detail || '';
    b.style.display = 'flex';
}

function cacherBadgeAtout() {
    const b = document.getElementById('badge-atout');
    if (b) b.style.display = 'none';
    const m = document.getElementById('modal-fin-manche');
    if (m) m.style.display = 'none';
}

function majIndicateurTour(monTour) {
    const ind = document.getElementById('indicateur-tour');
    if (ind) ind.style.display = monTour ? 'block' : 'none';
}

function afficherFinManche(o) {
    const m = document.getElementById('modal-fin-manche');
    if (!m) return;
    const rows = o.lignes.map(l => `<tr class="${l[3] || ''}"><td>${l[0]}</td><td>${l[1]}</td><td>${l[2]}</td></tr>`).join('');
    document.getElementById('fin-manche-contenu').innerHTML =
        `<h2>${o.titre}</h2>
         <p class="fin-resultat ${o.classe}">${o.sousTitre}</p>
         <table class="fin-table"><thead><tr><th></th><th>Nous</th><th>Eux</th></tr></thead><tbody>${rows}</tbody></table>
         <div class="fin-boutons" id="fin-boutons"></div>`;
    const zone = document.getElementById('fin-boutons');
    const btn = document.createElement('button');
    btn.className = 'btn-action btn-vert'; btn.textContent = o.texteBouton;
    btn.onclick = () => { m.style.display = 'none'; o.onSuivant(); };
    zone.appendChild(btn);
    if (o.fin) {
        const b2 = document.createElement('button');
        b2.className = 'btn-action btn-rouge'; b2.textContent = 'Retour au menu';
        b2.onclick = () => { window.location.href = 'index.html'; };
        zone.appendChild(b2);
    }
    m.style.display = 'flex';
}