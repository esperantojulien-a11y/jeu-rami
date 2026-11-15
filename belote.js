// ==========================================
// LOGIQUE DE LA BELOTE (V3 - Multijoueur)
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

// Variables Réseau
let currentUser = null;
let currentRoomId = null;
let isHost = false;
let unsubscribeRoom = null;
let joueursEnLigne = [];
let modeEnLigne = false;
let monSiege = 0;

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

// ==========================================
// CRÉATION ET REJOINTURE DE SALON
// ==========================================
async function creerSalonBelote() {
    if (!currentUser) return alert("Connexion en cours...");
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
        await window.firebase.setDoc(window.firebase.doc(window.firebase.db, "rooms", roomId), {
            host: currentUser.uid,
            jeu: "belote",
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
        
        ecouterSalonBelote(roomId);
    } catch (e) { console.error(e); alert("Erreur de création"); }
}

async function rejoindreSalonBelote() {
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
        
        ecouterSalonBelote(roomId);
    } catch (e) { console.error(e); alert("Erreur pour rejoindre"); }
}

function ecouterSalonBelote(roomId) {
    if (unsubscribeRoom) unsubscribeRoom();
    
    unsubscribeRoom = window.firebase.onSnapshot(window.firebase.doc(window.firebase.db, "rooms", roomId), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            joueursEnLigne = data.joueurs;
            
            // UI de la salle d'attente
            const listeDiv = document.getElementById('liste-joueurs-salon');
            if(listeDiv) {
                listeDiv.innerHTML = "";
                for (let i = 0; i < 4; i++) {
                    const j = joueursEnLigne.find(p => p.seat === i);
                    if (j) listeDiv.innerHTML += `<div>✅ Joueur ${i+1} : ${j.nom}</div>`;
                    else listeDiv.innerHTML += `<div style="color:gray">⏳ En attente (Place ${i+1})...</div>`;
                }
            }

            if (isHost) {
                document.getElementById('btn-lancer-partie-en-ligne').style.display = 'block';
            }

            // Si la partie a été lancée par l'hôte, on passe à la table
            if (data.status === "playing" && document.getElementById('table-belote').style.display === 'none') {
                document.getElementById('ecran-attente').style.display = 'none';
                document.getElementById('table-belote').style.display = 'flex';
                
                // Charger le jeu depuis Firebase
                chargerEtatJeuDepuisReseau(data);
            } else if (data.status === "playing") {
                // Mise à jour en cours de partie
                chargerEtatJeuDepuisReseau(data);
            }
        }
    });
}

function demarrerBeloteEnLigne() {
    if (!isHost) return;
    
    // 1. L'hôte prépare les 4 joueurs (complète avec IA si besoin)
    let joueursComplets = [];
    for (let i = 0; i < 4; i++) {
        let j = joueursEnLigne.find(p => p.seat === i);
        if (j) {
            joueursComplets.push({ id: i, nom: j.nom, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: false, uid: j.uid });
        } else {
            joueursComplets.push({ id: i, nom: `IA (Siège ${i+1})`, main: [], equipe: i % 2 === 0 ? 1 : 2, isIA: true, uid: "ia" });
        }
    }

    // 2. L'hôte distribue
    joueursBelote = joueursComplets;
    creerDeckBelote();
    distribuerBelote();
    
    // Pour simplifier l'online V1 : L'hôte choisit l'atout au hasard et lance direct
    atoutActuel = couleursBelote[Math.floor(Math.random() * couleursBelote.length)];
    tourActuel = 0;

    // 3. Sauvegarder l'état sur Firebase
    const gameState = {
        status: "playing",
        atout: atoutActuel,
        tour: tourActuel,
        joueurs: joueursBelote,
        scores: scoresBelote
    };

    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), gameState);
}

function chargerEtatJeuDepuisReseau(data) {
    // On récupère l'état depuis la base
    atoutActuel = data.atout;
    tourActuel = data.tour;
    joueursBelote = data.joueurs;
    scoresBelote = data.scores;
        // Si on est l'hôte, on vérifie s'il y a une action d'un autre joueur à traiter
    if (isHost && data.actionEnAttente) {
        const action = data.actionEnAttente;
        // On efface l'action pour ne pas la rejouer
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
            "actionEnAttente": null
        });
        
        // L'hôte applique le coup du joueur
        let indexCarte = action.indexCarte;
        let joueurId = action.joueur;
        
        let carteJouee = joueursBelote[joueurId].main.splice(indexCarte, 1)[0];
        pliEnCours.push({ joueur: joueurId, carte: carteJouee });
        cartesPli.push({ joueur: joueurId, carte: carteJouee });
        
        afficherPli();
        tourActuel = (tourActuel + 1) % 4;
        
        // L'hôte renvoie le nouvel état au serveur
        window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
            "joueurs": joueursBelote,
            "tour": tourActuel
        });

        // Si c'est une IA qui doit jouer après, l'hôte la fait jouer
        if (joueursBelote[tourActuel].isIA) {
            setTimeout(() => iaJoue(tourActuel), 1500);
        }
        
        // Si le pli est fini, l'hôte le résout
        if (pliEnCours.length === 4) {
            setTimeout(resoudrePli, 1500);
        }
    }

    // Affichage de l'atout
    document.getElementById('affichage-atout').innerHTML = `Atout : <span style="font-size:30px; color:${atoutActuel === 'coeur' || atoutActuel === 'carreau' ? 'red' : 'white'};">${getSymbole(atoutActuel)}</span>`;
    
    // On affiche SEULEMENT notre main
    let maMain = joueursBelote.find(j => j.uid === currentUser.uid)?.main || [];
    afficherMainReseau(maMain);
    mettreAJourInfos();

    // SI on est l'hôte ET que c'est au tour d'une IA, on la fait jouer
    if (isHost && joueursBelote[tourActuel].isIA) {
        setTimeout(() => {
            let indexCarte = choisirCarteIA(tourActuel);
            if (indexCarte !== -1) {
                jouerCarteReseau(tourActuel, indexCarte);
            }
        }, 1500);
    }
}

// ==========================================
// LOGIQUE LOCALE (Adaptée pour le réseau)
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
    
    creerDeckBelote();
    distribuerBelote();
    lancerEncheres();
}

function creerDeckBelote() {
    deckBelote = [];
    for (let couleur of couleursBelote) {
        for (let valeur of valeursBelote) {
            deckBelote.push({ valeur, couleur });
        }
    }
    for (let i = deckBelote.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckBelote[i], deckBelote[j]] = [deckBelote[j], deckBelote[i]];
    }
}

function distribuerBelote() {
    joueursBelote.forEach(j => j.main = []);
    for (let i = 0; i < 3; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    deckBelote.pop(); deckBelote.pop(); 
    for (let i = 0; i < 5; i++) joueursBelote.forEach(j => j.main.push(deckBelote.pop()));
    
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

// --- AFFICHAGE ---
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

function afficherMainBelote() {
    const conteneur = document.getElementById('main-belote');
    conteneur.innerHTML = "";
    joueursBelote[0].main.forEach((carte, index) => {
        const img = document.createElement('img');
        img.src = getImageCarte(carte);
        img.className = "carte-belote";
        img.onclick = () => {
            if (modeEnLigne) jouerCarteReseau(monSiege, index);
            else jouerCarte(0, index);
        };
        conteneur.appendChild(img);
    });
}

function afficherMainReseau(maMain) {
    const conteneur = document.getElementById('main-belote');
    conteneur.innerHTML = "";
    maMain.forEach((carte, index) => {
        const img = document.createElement('img');
        img.src = getImageCarte(carte);
        img.className = "carte-belote";
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
    if(document.getElementById('score-eq1')) document.getElementById('score-eq1').textContent = scoresBelote[1];
    if(document.getElementById('score-eq2')) document.getElementById('score-eq2').textContent = scoresBelote[2];
    
    // Affichage des noms des joueurs
    if (joueursBelote.length === 4) {
        document.getElementById('nom-j2').textContent = joueursBelote[2].nom;
        document.getElementById('nom-j1').textContent = joueursBelote[1].nom;
        document.getElementById('nom-j3').textContent = joueursBelote[3].nom;
        
        document.getElementById('nom-j2').className = `badge-joueur ${tourActuel === 2 ? 'actif' : ''}`;
        document.getElementById('nom-j1').className = `badge-joueur ${tourActuel === 1 ? 'actif' : ''}`;
        document.getElementById('nom-j3').className = `badge-joueur ${tourActuel === 3 ? 'actif' : ''}`;
    }
}

// --- ENCHERES (Mode Local) ---
function lancerEncheres() {
    document.getElementById('modal-encheres').style.display = 'flex';
}

function validerEnchere(couleur) {
    if (couleur) {
        atoutActuel = couleur;
        document.getElementById('affichage-atout').innerHTML = `Atout : <span style="font-size:30px; color:${atoutActuel === 'coeur' || atoutActuel === 'carreau' ? 'red' : 'white'};">${getSymbole(atoutActuel)}</span>`;
        document.getElementById('modal-encheres').style.display = 'none';
        tourActuel = 0; 
        mettreAJourInfos();
    } else {
        document.getElementById('modal-encheres').style.display = 'none';
        iaEnchere(1);
    }
}

function iaEnchere(idJoueur) {
    if (idJoueur > 3) {
        alert("Tout le monde a passé ! On redistribue.");
        return lancerBelote();
    }
    const main = joueursBelote[idJoueur].main;
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

    if (meilleurScore >= 12) {
        atoutActuel = meilleurAtout;
        document.getElementById('affichage-atout').innerHTML = `Atout : <span style="font-size:30px; color:${atoutActuel === 'coeur' || atoutActuel === 'carreau' ? 'red' : 'white'};">${getSymbole(atoutActuel)}</span>`;
        trierMains();
        tourActuel = idJoueur;
        mettreAJourInfos();
    } else {
        setTimeout(() => iaEnchere(idJoueur + 1), 500);
    }
}

// --- JEU (Mutualisé Local & Réseau) ---
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
    if (!estCoupValide(idJoueur, indexCarte, joueursBelote[idJoueur].main, couleurDemandee)) return;

    let carteJouee = joueursBelote[idJoueur].main.splice(indexCarte, 1)[0];
    
    pliEnCours.push({ joueur: idJoueur, carte: carteJouee });
    cartesPli.push({ joueur: idJoueur, carte: carteJouee });
    
    afficherPli();
    afficherMainBelote();
    
    if (pliEnCours.length === 4) {
        partieBloquee = true;
        setTimeout(resoudrePli, 1500);
    } else {
        tourActuel = (tourActuel + 1) % 4;
        mettreAJourInfos();
        if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 1000);
    }
}

function jouerCarteReseau(monSiege, indexCarte) {
    if (tourActuel !== monSiege) return alert("Ce n'est pas votre tour !");

    const maMain = joueursBelote.find(j => j.uid === currentUser.uid).main;
    const couleurDemandee = pliEnCours.length > 0 ? pliEnCours[0].carte.couleur : null;
    
    if (!estCoupValide(monSiege, indexCarte, maMain, couleurDemandee)) {
        return alert("Coup invalide (vous devez fournir la couleur ou couper) !");
    }

    // On envoie juste l'action à l'hôte, sans modifier les autres joueurs
    window.firebase.updateDoc(window.firebase.doc(window.firebase.db, "rooms", currentRoomId), {
        "actionEnAttente": {
            joueur: monSiege,
            indexCarte: indexCarte
        }
    });
}

function iaJoue(idJoueur) {
    if (tourActuel !== idJoueur || partieBloquee) return;
    let indexCarte = choisirCarteIA(idJoueur);
    if (indexCarte !== -1) jouerCarte(idJoueur, indexCarte);
}

function choisirCarteIA(idJoueur) {
    const main = joueursBelote[idJoueur].main;
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

    let equipeGagnante = joueursBelote[gagnant].equipe;
    scoresBelote[equipeGagnante] += pointsPli;
    
    mettreAJourInfos();
    
    setTimeout(() => {
        pliEnCours = []; cartesPli = [];
        document.getElementById('zone-pli').innerHTML = "";
        tourActuel = gagnant;
        mettreAJourInfos();
        partieBloquee = false;
        
        if (joueursBelote[0].main.length === 0) {
            alert(`Fin de la manche !\nNous : ${scoresBelote[1]} pts\nEux : ${scoresBelote[2]} pts`);
            window.location.reload();
        } else {
            if (tourActuel !== 0) setTimeout(() => iaJoue(tourActuel), 1000);
        }
    }, 1500);
}

function estPlusForte(carte1, carte2) {
    let ordre = (carte1.couleur === atoutActuel) ? ordreAtout : ordreNormal;
    return ordre.indexOf(carte1.valeur) > ordre.indexOf(carte2.valeur);
}