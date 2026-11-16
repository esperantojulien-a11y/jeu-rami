// ==========================================
// LOGIQUE DE LA BELOTE (V18 - Prise à l'aveugle sur 5 cartes, sans carte retournée)
// ==========================================

const couleursBelote = ['coeur', 'carreau', 'trefle', 'pique'];
const valeursBelote = ['7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];
const pointsBelote = { 'as': 11, '10': 10, 'roi': 4, 'dame': 3, 'valet': 2, '9': 0, '8': 0, '7': 0 };
const ordreAtout = ['7', '8', 'dame', 'roi', '10', 'as', '9', 'valet'];
const ordreNormal = ['7', '8', '9', 'valet', 'dame', 'roi', '10', 'as'];
const ordreSuite = ['7', '8', '9', '10', 'valet', 'dame', 'roi', 'as'];

let deckBelote = [];
let joueursBelote = [];
let atoutActuel = null;
let carteRetournee = null; 
let phaseEncheres = 1; 
let tourActuel = 0;
let pliEnCours = [];
let cartesPli = [];
let scoresBelote = { 1: 0, 2: 0 };
let scoresManche = { 1: 0, 2: 0 };
let nombrePli = 0;
let partieBloquee = true; // BLOQUE LE JEU AU DEPART
let preneur = -1;
let donneur = 0; 
let aDitBelote = false;
let aDitRebelote = false;
let beloteJoueur = -1;
let niveauDifficulteBelote = 'facile';
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
// FONCTIONS UTILITAIRES
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

function getSymbole(couleur) {
    if (couleur === 'coeur') return '♥'; if (couleur === 'carreau') return '♦';
    if (couleur === 'trefle') return '♣'; return '♠';
}

function getImageCarte(carte) {
    if (!carte) return '';
    let valAnglaise = { 'as': 'ace', 'valet': 'jack', 'dame': 'queen', 'roi': 'king' }[carte.valeur] || carte.valeur;
    let coulAnglaise = { 'coeur': 'hearts', 'carreau': 'diamonds', 'trefle': 'clubs', 'pique': 'spades' }[carte.couleur];
    return `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`;
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

// (Les fonctions Firebase restent inchangées, on garde la création de salon)
async function creerSalonBelote() { /* ... ton code identique ... */ }
async function rejoindreSalonBelote() { /* ... ton code identique ... */ }
function ecouterSalonBelote(roomId) { /* ... ton code identique ... */ }
function demarrerBeloteEnLigne() { /* ... ton code identique ... */ }
function chargerEtatJeuDepuisReseau(data) { /* ... ton code identique ... */ }

// ==========================================
// LOGIQUE LOCALE (V17 - Règles corrigées)
// ==========================================

// Détail des points de la manche EN COURS (remis à zéro à chaque manche)
let detailManche = { plis: { 1: 0, 2: 0 }, belote: { 1: 0, 2: 0 }, annonces: { 1: 0, 2: 0 } };
let plisGagnes = { 1: 0, 2: 0 };
let passesEnchere = 0;

function totalManche(eq) {
    return detailManche.plis[eq] + detailManche.belote[eq] + detailManche.annonces[eq];
}

function lancerBelote() {
    document.getElementById('ecran-accueil').style.display = 'none';
    document.getElementById('table-belote').style.display = 'flex';
    modeEnLigne = false;
    partieBloquee = true;

    // --- REMISE À ZÉRO COMPLÈTE DE LA MANCHE ---
    detailManche = { plis: { 1: 0, 2: 0 }, belote: { 1: 0, 2: 0 }, annonces: { 1: 0, 2: 0 } };
    plisGagnes = { 1: 0, 2: 0 };
    nombrePli = 0;
    pliEnCours = [];
    cartesPli = [];
    atoutActuel = null;
    preneur = -1;
    passesEnchere = 0;
    aAnnonce = false;
    document.getElementById('zone-pli').innerHTML = "";
    cacherBadgeAtout();
    const affAtout = document.getElementById('affichage-atout');
    if (affAtout) affAtout.textContent = "Atout : En attente";
    const infoBel = document.getElementById('info-belote-rebelote');
    if (infoBel) infoBel.style.display = 'none';

    joueursBelote = [
        { id: 0, nom: "Vous", main: [], equipe: 1, isIA: false, aBelote: false, beloteJouees: 0 },
        { id: 1, nom: "Gauche", main: [], equipe: 2, isIA: true, aBelote: false, beloteJouees: 0 },
        { id: 2, nom: "Partenaire", main: [], equipe: 1, isIA: true, aBelote: false, beloteJouees: 0 },
        { id: 3, nom: "Droite", main: [], equipe: 2, isIA: true, aBelote: false, beloteJouees: 0 }
    ];

    donneur = (donneur + 1) % 4;
    afficherToast(`C'est ${joueursBelote[donneur].nom} qui distribue.`);

    creerDeckBelote();
    distribuerPhase1();

    tourActuel = (donneur + 1) % 4;
    phaseEncheres = 1;
    mettreAJourInfos();
    lancerEncheres();
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

// PHASE 1 : 5 cartes par joueur (3 puis 2). Les 3 dernières cartes de chacun restent inconnues.
// Il n'y a PAS de carte retournée : on décide de prendre à l'aveugle.
function distribuerPhase1() {
    carteRetournee = null;
    joueursBelote.forEach(j => j.main = []);
    for (let i = 0; i < 3; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    for (let i = 0; i < 2; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    trierMains();
}

// PHASE 2 (après la prise) : chacun reçoit ses 3 dernières cartes -> 8 cartes par joueur
function distribuerPhase2() {
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            joueursBelote[j].main.push(deckBelote.pop());
        }
    }
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

function afficherMainBelote() {
    const conteneur = document.getElementById('main-belote');
    if (!conteneur) return;
    conteneur.innerHTML = "";
    const main = joueursBelote[0].main;
    // (Plus d'aide visuelle : aucune carte n'est mise en surbrillance ni grisée)
    const monTour = !modeEnLigne && !partieBloquee && tourActuel === 0 && !!atoutActuel && pliEnCours.length < 4;
    majIndicateurTour(monTour);
    main.forEach((carte, index) => {
        if (!carte) return;
        const img = document.createElement('img'); img.src = getImageCarte(carte); img.className = "carte-belote";
        img.onclick = () => { if (!partieBloquee) { if (modeEnLigne) jouerCarteReseau(monSiege, index); else jouerCarte(0, index); } };
        conteneur.appendChild(img);
    });
}

function afficherCarteRetournee() {
    const divRetourne = document.getElementById('div-retourne');
    if (divRetourne) {
        divRetourne.innerHTML = "";
        if (carteRetournee) {
            const img = document.createElement('img');
            img.src = getImageCarte(carteRetournee);
            img.style.width = "80px";
            img.style.borderRadius = "8px";
            img.style.boxShadow = "0 0 15px #f1c40f";
            divRetourne.appendChild(img);
        }
    }
}

function afficherPli() {
    const zone = document.getElementById('zone-pli');
    if (!zone) return;
    zone.innerHTML = "";
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
    set('score-eq1', scoresBelote[1]);          // total de la partie
    set('score-eq2', scoresBelote[2]);
    set('manche-eq1', totalManche(1));          // points de la manche en cours
    set('manche-eq2', totalManche(2));
    if (joueursBelote.length === 4) {
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`nom-j${i}`);
            if (el) el.className = `badge-joueur ${tourActuel === i ? 'actif' : ''}`;
        }
        afficherAdversaires();
        afficherMainBelote();
    }
}

// ==========================================
// ENCHERES
// ==========================================
function lancerEncheres() {
    document.getElementById('modal-encheres').style.display = 'flex';
    document.getElementById('titre-enchere').textContent = "Voulez-vous prendre ?";
    afficherOptionsEncheresBelote(tourActuel);
}

function afficherOptionsEncheresBelote(idJoueur) {
    mettreAJourInfos();
    const zone = document.getElementById('boutons-encheres');
    if (idJoueur === 0) {
        document.getElementById('message-enchere').textContent = "À vous : choisissez votre atout ou passez (3 cartes restent inconnues).";
        if (zone) { zone.style.pointerEvents = "auto"; zone.style.opacity = "1"; }
    } else {
        document.getElementById('message-enchere').textContent = `${joueursBelote[idJoueur].nom} réfléchit...`;
        if (zone) { zone.style.pointerEvents = "none"; zone.style.opacity = "0.5"; }
        setTimeout(() => iaEnchere(idJoueur), 1000);
    }
}

// Le joueur humain choisit un atout (il prend) ou passe
function validerEncherePhase2(couleur) {
    if (tourActuel !== 0 || preneur !== -1) return;
    prendreAtout(0, couleur);
}

function passerEnchereBelote() {
    if (tourActuel !== 0 || preneur !== -1) return;
    afficherToast("Vous passez.");
    passerTourEnchere();
}

// Quelqu'un passe : on passe au suivant. Si les 4 ont passé, on redistribue.
function passerTourEnchere() {
    passesEnchere++;
    if (passesEnchere >= 4) {
        document.getElementById('modal-encheres').style.display = 'none';
        afficherToast("Personne ne prend : on redistribue !");
        setTimeout(lancerBelote, 1500);
        return;
    }
    tourActuel = (tourActuel + 1) % 4;
    lancerEncheres();
}

function prendreAtout(idJoueur, couleur) {
    atoutActuel = couleur;
    preneur = idJoueur;
    document.getElementById('modal-encheres').style.display = 'none';

    const affAtout = document.getElementById('affichage-atout');
    if (affAtout) {
        const rouge = (couleur === 'coeur' || couleur === 'carreau');
        affAtout.innerHTML = `Atout : <span class="atout-symbole ${rouge ? 'rouge' : 'noir'}">${getSymbole(couleur)}</span>`;
    }

    afficherToast(idJoueur === 0
        ? `Vous avez pris à ${getSymbole(couleur)} !`
        : `${joueursBelote[idJoueur].nom} a pris à ${getSymbole(couleur)} !`);
    jouerSon(sonPoser);

    distribuerPhase2();
    afficherAtoutSurJoueur();
    afficherBadgeAtout(idJoueur === 0 ? 'Pris par vous' : 'Pris par ' + joueursBelote[idJoueur].nom);
    finirEncheres();
}

function iaEnchere(idJoueur) {
    if (tourActuel !== idJoueur || preneur !== -1) return;
    const main = joueursBelote[idJoueur].main;

    // L'IA ne voit que ses 5 premières cartes : elle juge chaque couleur sur ce qu'elle a en main
    const evaluer = (couleur) => {
        let score = 0;
        main.forEach(c => {
            if (c.couleur === couleur) { score += 4; if (c.valeur === 'valet') score += 10; if (c.valeur === '9') score += 8; }
        });
        return score;
    };

    let meilleur = null, meilleurScore = 0;
    couleursBelote.forEach(couleur => {
        const s = evaluer(couleur);
        if (s > meilleurScore) { meilleurScore = s; meilleur = couleur; }
    });

    // Le dernier à parler (le donneur) est un peu moins exigeant pour éviter trop de redistributions
    const seuil = passesEnchere === 3 ? 12 : 16;
    if (meilleur && meilleurScore >= seuil) return prendreAtout(idJoueur, meilleur);

    afficherToast(`${joueursBelote[idJoueur].nom} passe.`);
    passerTourEnchere();
}

function aBeloteEnMain(main) {
    return main.some(c => c && c.couleur === atoutActuel && c.valeur === 'roi')
        && main.some(c => c && c.couleur === atoutActuel && c.valeur === 'dame');
}

function finirEncheres() {
    joueursBelote.forEach(j => {
        // Belote-Rebelote : valable pour TOUS les joueurs (vous, partenaire, adversaires)
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
    if (joueursBelote[0].aBelote) afficherToast(`Vous avez Belote-Rebelote !<br>Jouez le Roi et la Dame d'atout (+20 pts)`);
    mettreAJourInfos();

    document.getElementById('btn-annonces').style.display = 'block';

    setTimeout(() => {
        partieBloquee = false;
        demarrerJeu((donneur + 1) % 4);
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
    let res = detecterAnnonces(joueursBelote[0].main, atoutActuel);
    if (res.points > 0) {
        detailManche.annonces[joueursBelote[0].equipe] += res.points;
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

    // Meilleur atout déjà posé dans le pli (-1 s'il n'y en a pas)
    let meilleurAtoutPli = -1;
    pliEnCours.forEach(p => {
        if (p.carte.couleur === atoutActuel) meilleurAtoutPli = Math.max(meilleurAtoutPli, ordreAtout.indexOf(p.carte.valeur));
    });

    if (aCouleur) {
        if (carte.couleur !== couleurDemandee) { msg(`Vous devez fournir du ${couleurDemandee} !`); return false; }
        // Couleur demandée = atout : il faut monter si on le peut
        if (couleurDemandee === atoutActuel) {
            const idx = ordreAtout.indexOf(carte.valeur);
            const aPlusFort = atoutsMain.some(c => ordreAtout.indexOf(c.valeur) > meilleurAtoutPli);
            if (aPlusFort && idx < meilleurAtoutPli) { msg("Vous devez monter à l'atout !"); return false; }
        }
        return true;
    }

    // Pas la couleur demandée
    const maitre = trouverMaitrePli(pliEnCours);
    const partenaireMaitre = joueursBelote[maitre.joueur].equipe === joueursBelote[idJoueur].equipe;
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
    tourActuel = premierJoueur;
    mettreAJourInfos();
    afficherMainBelote();
    if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800);
}

function jouerCarte(idJoueur, indexCarte) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    const joueur = joueursBelote[idJoueur];
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(idJoueur, indexCarte, joueur.main, couleurDemandee)) return;

    let carteJouee = joueur.main.splice(indexCarte, 1)[0];
    if (!carteJouee) return;

    jouerSon(sonPoser);

    // BELOTE / REBELOTE (pour tous les joueurs, +20 pts à son équipe dès la Rebelote)
    if (joueur.aBelote && carteJouee.couleur === atoutActuel && (carteJouee.valeur === 'roi' || carteJouee.valeur === 'dame')) {
        joueur.beloteJouees++;
        const info = document.getElementById('info-belote-rebelote');
        if (joueur.beloteJouees === 1) {
            afficherToast(`<strong>${joueur.nom} : BELOTE !</strong>`);
            if (info) { info.style.display = 'block'; info.textContent = `${joueur.nom} : Belote !`; }
        } else {
            detailManche.belote[joueur.equipe] += 20;
            afficherToast(`<strong>${joueur.nom} : REBELOTE !</strong> (+20 pts)`);
            if (info) { info.style.display = 'block'; info.textContent = `${joueur.nom} : Rebelote ! +20`; }
            mettreAJourInfos();
        }
    }

    pliEnCours.push({ joueur: idJoueur, carte: carteJouee });
    cartesPli.push({ joueur: idJoueur, carte: carteJouee });
    afficherPli();
    if (pliEnCours.length === 4) partieBloquee = true;
    afficherMainBelote();

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
    const maMain = joueursBelote.find(j => j.uid === currentUser.uid).main;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    if (!estCoupValide(monSiege, indexCarte, maMain, couleurDemandee)) return afficherToast("Coup invalide !");
    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), { "actionEnAttente": { joueur: monSiege, indexCarte: indexCarte } });
}

function iaJoue(idJoueur) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    let indexCarte = choisirCarteIA(idJoueur);
    if (indexCarte !== -1) jouerCarte(idJoueur, indexCarte);
}

// L'IA ne choisit QUE parmi les cartes autorisées
function choisirCarteIA(idJoueur) {
    const main = joueursBelote[idJoueur].main;
    if (main.length === 0) return -1;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;

    const valides = [];
    main.forEach((c, i) => { if (c && estCoupValide(idJoueur, i, main, couleurDemandee, true)) valides.push(i); });
    if (valides.length === 0) return 0;

    const force = (c) => c.couleur === atoutActuel ? 100 + ordreAtout.indexOf(c.valeur) : ordreNormal.indexOf(c.valeur);

    let partenaireMaitre = false;
    if (pliEnCours.length > 0) {
        const m = trouverMaitrePli(pliEnCours);
        partenaireMaitre = joueursBelote[m.joueur].equipe === joueursBelote[idJoueur].equipe;
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
    const eq = joueursBelote[gagnant].equipe;

    let pointsPli = pliEnCours.reduce((sum, item) => sum + pointsCarte(item.carte), 0);
    nombrePli++;
    plisGagnes[eq]++;
    if (nombrePli === 8) { pointsPli += 10; afficherToast("+10 points (Dix de Der) !"); }

    detailManche.plis[eq] += pointsPli;
    mettreAJourInfos();
    jouerSon(sonPiocher);

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
        tourActuel = gagnant; partieBloquee = false; mettreAJourInfos();
        if (joueursBelote[0].main.length === 0) finDeMancheBelote();
        else { if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 800); }
    }, 1000);
}

function estPlusForte(carte1, carte2) {
    let ordre = (carte1.couleur === atoutActuel) ? ordreAtout : ordreNormal;
    return ordre.indexOf(carte1.valeur) > ordre.indexOf(carte2.valeur);
}

function finDeMancheBelote() {
    const eqP = joueursBelote[preneur].equipe;
    const eqD = eqP === 1 ? 2 : 1;

    // Capot : une équipe a fait les 8 plis
    let capotTxt = "";
    [1, 2].forEach(eq => {
        if (plisGagnes[eq] === 8) { detailManche.plis[eq] += 90; capotTxt = ` · CAPOT ${eq === 1 ? 'des vôtres' : 'adverse'} (+90)`; }
    });

    // Le preneur doit avoir STRICTEMENT plus de points que la défense, sinon il est "dedans"
    const reussi = totalManche(eqP) > totalManche(eqD);
    let resume;
    if (reussi) {
        resume = "✅ Le preneur remplit son contrat";
    } else {
        resume = "❌ Le preneur est DEDANS : la défense récupère les plis";
        detailManche.plis[eqD] += detailManche.plis[eqP];
        detailManche.plis[eqP] = 0;
        detailManche.annonces[eqD] += detailManche.annonces[eqP];
        detailManche.annonces[eqP] = 0;
        // la belote du preneur reste acquise
    }

    // On ajoute SEULEMENT les points de CETTE manche au total de la partie
    scoresBelote[1] += totalManche(1);
    scoresBelote[2] += totalManche(2);
    mettreAJourInfos();

    const fin = scoresBelote[1] >= 1000 || scoresBelote[2] >= 1000;
    const nousGagnons = scoresBelote[1] >= scoresBelote[2];
    jouerSon(fin ? (nousGagnons ? sonVictoire : sonDefaite) : (eqP === 1 ? (reussi ? sonVictoire : sonDefaite) : (reussi ? sonDefaite : sonVictoire)));

    afficherFinManche({
        titre: fin ? (nousGagnons ? "🏆 Victoire !" : "Défaite...") : "Fin de la manche",
        sousTitre: `${resume}<br>Preneur : ${joueursBelote[preneur].nom} (${getSymbole(atoutActuel)})${capotTxt}`
                   + (fin ? `<br><strong>${nousGagnons ? 'Votre équipe' : "L'équipe adverse"} remporte la partie !</strong>` : ''),
        classe: (eqP === 1) === reussi ? 'ok' : 'ko',
        lignes: [
            ['Plis (dix de der inclus)', detailManche.plis[1], detailManche.plis[2]],
            ['Belote-Rebelote', detailManche.belote[1], detailManche.belote[2]],
            ['Annonces', detailManche.annonces[1], detailManche.annonces[2]],
            ['Total de la manche', totalManche(1), totalManche(2), 'total'],
            ['Total de la partie', scoresBelote[1], scoresBelote[2], 'grand-total']
        ],
        fin: fin,
        texteBouton: fin ? 'Rejouer' : 'Manche suivante',
        onSuivant: () => { if (fin) scoresBelote = { 1: 0, 2: 0 }; lancerBelote(); }
    });
}

function afficherAtoutSurJoueur() {
    for (let i = 1; i <= 3; i++) {
        let el = document.getElementById(`nom-j${i}`);
        if (el && joueursBelote[i]) el.innerHTML = joueursBelote[i].nom;
    }
    if (!atoutActuel || preneur === -1) return;

    let preneurElement = document.getElementById(`nom-j${preneur}`);
    if (preneurElement) {
        let estRouge = (atoutActuel === 'coeur' || atoutActuel === 'carreau');
        let couleur = estRouge ? '#e74c3c' : '#ffffff';
        preneurElement.innerHTML += ` <span style="font-size:20px; color:${couleur}; text-shadow: 1px 1px 2px black;">[${getSymbole(atoutActuel)}]</span>`;
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
    if (joueursBelote.length !== 4) return;
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`eventail-j${i}`);
        if (!el) continue;
        const n = joueursBelote[i].main.length;
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