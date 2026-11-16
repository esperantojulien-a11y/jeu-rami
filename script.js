// ==========================================
// NAVIGATION MENU
// ==========================================
function ouvrirJeu(nomJeu) {
    if (nomJeu === 'rami') {
        document.getElementById('menu-principal').style.display = 'none';
        document.getElementById('ecran-accueil').style.display = 'flex';
    }
}

function retourMenu() {
    document.getElementById('ecran-accueil').style.display = 'none';
    document.getElementById('table-de-jeu').style.display = 'none';
    document.getElementById('menu-principal').style.display = 'flex';
    mancheTerminee = true;
}

// ==========================================
// RÉSEAU ET MULTIJOUEUR (FIREBASE)
// ==========================================
let currentUser = null;
let currentRoomId = null;
let unsubscribeRoom = null;
let unsubscribeLobby = null;
let isHost = false;
let gameType = "rami";

window.addEventListener('load', () => {
    if (window.firebase) {
        window.firebase.auth.onAuthStateChanged((user) => {
            currentUser = user;
        });
    }
});

function ecouterLobby() {
    if (unsubscribeLobby) unsubscribeLobby();

    const q = window.firebase.query(
        window.firebase.collection(window.firebase.db, "rooms"),
        window.firebase.where("status", "==", "waiting"),
        window.firebase.where("jeu", "==", gameType)
    );

    unsubscribeLobby = window.firebase.onSnapshot(q, (snapshot) => {
        const listeDiv = document.getElementById("liste-salons");
        listeDiv.innerHTML = "";
        let salonsTrouves = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.estPrive === false) {
                salonsTrouves++;
                const btn = document.createElement("button");
                btn.className = "btn-action btn-vert";
                btn.style.width = "100%";
                btn.style.padding = "10px";
                btn.style.fontSize = "14px";
                btn.style.marginBottom = "5px";
                btn.textContent = `Rejoindre le salon ${doc.id}`;
                btn.onclick = () => {
                    document.getElementById("input-salon").value = doc.id;
                    rejoindreSalon();
                };
                listeDiv.appendChild(btn);
            }
        });

        if (salonsTrouves === 0) {
            listeDiv.innerHTML = "<p class='chargement'>Aucun salon public disponible.</p>";
        }
    });
}

async function creerSalon(estPrive = false) {
    if (!currentUser) return alert("Connexion en cours, réessaie dans une seconde.");
    
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
        await window.firebase.setDoc(window.firebase.doc(window.firebase.db, "rooms", roomId), {
            host: currentUser.uid,
            guest: "",
            status: "waiting",
            jeu: gameType,
            estPrive: estPrive,
            createdAt: window.firebase.serverTimestamp(),
            gameState: {} 
        });
        
        currentRoomId = roomId;
        isHost = true;
        
        if (estPrive) {
            alert(`Salon PRIVÉ créé !\n\nCode à donner à ton ami : ${roomId}\n\nCe salon n'apparaît pas dans la liste publique.`);
        } else {
            alert(`Salon PUBLIC créé !\nCode : ${roomId}\nIl est visible par tout le monde dans la liste des salons.`);
        }
        
        ecouterSalon(roomId);
        
        document.getElementById("ecran-accueil").style.display = "none";
        document.getElementById("table-de-jeu").style.display = "flex";
        document.getElementById("info-joueur").textContent = "En attente d'un adversaire...";
        
    } catch (e) {
        console.error("Erreur de création :", e);
        alert("Erreur lors de la création du salon.");
    }
}

async function rejoindreSalon() {
    if (!currentUser) return alert("Connexion en cours, réessaie dans une seconde.");
    const roomCode = document.getElementById("input-salon").value.trim().toUpperCase();
    if (roomCode.length !== 6) return alert("Le code doit faire 6 caractères.");

    const roomRef = window.firebase.doc(window.firebase.db, "rooms", roomCode);

    try {
        const docSnap = await window.firebase.getDoc(roomRef);
        
        if (!docSnap.exists()) return alert("Ce salon n'existe pas.");
        
        const data = docSnap.data();
        if (data.status !== "waiting" || data.guest !== "") {
            return alert("Ce salon est déjà complet ou la partie a commencé.");
        }
        
        await window.firebase.updateDoc(roomRef, {
            guest: currentUser.uid,
            status: "playing"
        });
        
        currentRoomId = roomCode;
        isHost = false;
        alert("Salon rejoint avec succès !");
        
        document.getElementById("ecran-accueil").style.display = "none";
        document.getElementById("table-de-jeu").style.display = "flex";
        
        ecouterSalon(roomCode);
        
    } catch (e) {
        console.error("Erreur de jointure :", e);
        alert("Erreur lors de la connexion au salon.");
    }
}

function ecouterSalon(roomId) {
    if (unsubscribeRoom) unsubscribeRoom();
    if (unsubscribeLobby) unsubscribeLobby();
    
    unsubscribeRoom = window.firebase.onSnapshot(window.firebase.doc(window.firebase.db, "rooms", roomId), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            
            if (isHost && data.guest !== "" && data.status === "playing") {
                document.getElementById("info-joueur").textContent = "Adversaire connecté ! Préparation de la partie...";
            }
        }
    });
}

// ==========================================
// GESTION DU SON
// ==========================================
const sonPiocher = new Audio('audio/pioche.ogg');
const sonPoser = new Audio('audio/pose.ogg');
const sonVictoire = new Audio('audio/victoire.ogg');
const sonDefaite = new Audio('audio/defaite.ogg');
let estMuet = false;
function jouerSon(sound) {
    if (estMuet) return;
    sound.currentTime = 0;
    sound.volume = 0.3;
    sound.play().catch(e => console.log("Son bloqué"));
}

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let deck = [];
let combinaisonsTable = []; 
let carteDefausseActuelle = null; 

let joueurs = []; 
let joueurActuel = 0; 
let donneurRami = 0; // Garde en mémoire le joueur qui distribue
let premierTourGlobal = true; 
let mancheTerminee = false;

let nbJoueursTotal = 1;
let modeJeu = 'ia';
let niveauDifficulte = 'moyen';

const couleurs = ['coeur', 'carreau', 'trefle', 'pique'];
const valeurs = ['as', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'valet', 'dame', 'roi'];
const tradValeurs = { 'as': 'ace', 'valet': 'jack', 'dame': 'queen', 'roi': 'king' };
const tradCouleurs = { 'coeur': 'hearts', 'carreau': 'diamonds', 'trefle': 'clubs', 'pique': 'spades' };

const conteneurMain = document.getElementById("main-joueur");
const defausseHTML = document.getElementById("defausse");
const combinaisonsHTML = document.getElementById("combinaisons");
const btnPiocher = document.getElementById("btn-piocher");
const btnPoser = document.getElementById("btn-poser");
const btnVoler = document.getElementById("btn-voler");
const btnDefausser = document.getElementById("btn-defausser");

// ==========================================
// CONFIGURATION DE LA PARTIE
// ==========================================
function setNbJoueurs(nb) {
    nbJoueursTotal = nb;
    for(let i=1; i<=4; i++) document.getElementById(`btn-j${i}`).classList.remove('actif');
    document.getElementById(`btn-j${nb}`).classList.add('actif');
    
    if (nb === 1) {
        setMode('ia');
        document.getElementById("section-mode").style.display = "none";
    } else {
        document.getElementById("section-mode").style.display = "block";
    }
}

function setMode(mode) {
    modeJeu = mode;
    document.getElementById('btn-mode-ia').classList.remove('actif');
    document.getElementById('btn-mode-local').classList.remove('actif');
    document.getElementById(`btn-mode-${mode}`).classList.add('actif');

    if (modeJeu === 'ia') {
        document.getElementById("section-difficulte").style.display = "block";
    } else {
        document.getElementById("section-difficulte").style.display = "none";
    }
}

function setDifficulte(niveau) {
    niveauDifficulte = niveau;
    ['facile', 'moyen', 'difficile'].forEach(n => document.getElementById(`btn-${n}`).classList.remove('actif'));
    document.getElementById(`btn-${niveau}`).classList.add('actif');
}

function lancerPartie() {
    document.getElementById("ecran-accueil").style.display = "none";
    document.getElementById("table-de-jeu").style.display = "flex";
    
    joueurs = [];
    for (let i = 0; i < nbJoueursTotal; i++) {
        let isIA = (modeJeu === 'ia' && i > 0);
        joueurs.push({
            id: i,
            nom: isIA ? `IA ${i}` : `Joueur ${i + 1}`,
            main: [],
            score: 0,
            aPose: false,
            aPioche: false,
            isIA: isIA
        });
    }

    // Nettoyage des zones
    document.getElementById("adv-haut").innerHTML = "";
    document.getElementById("adv-gauche").innerHTML = "";
    document.getElementById("adv-droite").innerHTML = "";

    let iaCount = 1;
    joueurs.forEach(j => {
        if (j.isIA) {
            const htmlProfil = `<div class="profil-adversaire">
                <div class="avatar">🤖</div>
                <div class="infos-adversaire">
                    <h3>${j.nom}</h3>
                    <p id="info-ordi-${j.id}">13 cartes</p>
                </div>
            </div>`;

            // Distribution spatiale
            if (iaCount === 1) document.getElementById("adv-haut").innerHTML = htmlProfil; // 1ère IA en haut
            else if (iaCount === 2) document.getElementById("adv-gauche").innerHTML = htmlProfil; // 2ème à gauche
            else if (iaCount === 3) document.getElementById("adv-droite").innerHTML = htmlProfil; // 3ème à droite
            
            iaCount++;
        }
    });

    demarrerManche();
}
// ==========================================
// LOGIQUE DU JEU
// ==========================================
function demarrerManche() {
    mancheTerminee = false;
    premierTourGlobal = true;
    combinaisonsTable = [];
    combinaisonsHTML.innerHTML = "";
    
    // Rotation du donneur
    donneurRami = (donneurRami + 1) % joueurs.length;
    
    joueurs.forEach(j => { j.main = []; j.aPose = false; j.aPioche = false; });
    
    document.getElementById("ecran-victoire").style.display = "none";
    
    creerDeck();
    distribuerCartes(); // Modifiée ci-dessous
    afficherScores();
    preparerTour();
}

function creerDeck() {
    deck = [];
    
    // Les 4 images de jokers différentes de ton dossier
    const imagesJokers = [
        'cartes/jokers/red joker.png',
        'cartes/jokers/black joker.png',
        'cartes/jokers/red joker 1.png',
        'cartes/jokers/black joker 1.png'
    ];
    let indexJoker = 0;

    for (let i = 0; i < 2; i++) {
        for (let couleur of couleurs) {
            for (let valeur of valeurs) {
                deck.push({ valeur: valeur, couleur: couleur });
            }
        }
        // On ajoute 2 jokers par jeu avec leur image spécifique
        deck.push({ valeur: 'joker', couleur: 'joker', image: imagesJokers[indexJoker++] });
        deck.push({ valeur: 'joker', couleur: 'joker', image: imagesJokers[indexJoker++] });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function distribuerCartes() {
    // 13 cartes pour tout le monde
    for (let i = 0; i < 13; i++) {
        joueurs.forEach(j => j.main.push(deck.pop()));
    }
    
    // Le joueur à gauche du donneur prend une 14ème carte
    joueurActuel = (donneurRami + 1) % joueurs.length;
    joueurs[joueurActuel].main.push(deck.pop());
    
    joueurs.forEach(j => {
        j.main.sort((a, b) => {
            if (a.valeur === 'joker') return 1;
            if (b.valeur === 'joker') return -1;
            if (a.couleur === b.couleur) return valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur);
            return couleurs.indexOf(a.couleur) - couleurs.indexOf(b.couleur);
        });
    });

    carteDefausseActuelle = deck.pop();
    afficherCarteDefausse();
}
function afficherScores() {
    const conteneur = document.getElementById("scores-container");
    conteneur.innerHTML = "";
    joueurs.forEach(j => {
        conteneur.innerHTML += `
            <div class="score-box" style="${j.id === joueurActuel ? 'border: 2px solid var(--or); box-shadow: 0 0 10px var(--or);' : ''}">
                <span>${j.nom}</span>
                <strong>${j.score}</strong> pts
            </div>
        `;
    });
}

function preparerTour() {
    afficherScores();
    const j = joueurs[joueurActuel];
    
    joueurs.forEach(joueur => {
        if (joueur.isIA) {
            const el = document.getElementById(`info-ordi-${joueur.id}`);
            if (el) el.textContent = `${joueur.main.length} cartes`;
        }
    });

    if (j.isIA) {
        document.getElementById("zone-joueur").style.visibility = "hidden";
        setTimeout(tourIA, 1500);
    } else {
        if (modeJeu === 'local' && nbJoueursTotal > 1) {
            document.getElementById("titre-passe").textContent = `Au tour du ${j.nom}`;
            document.getElementById("ecran-passe").style.display = "flex";
            document.getElementById("table-de-jeu").style.visibility = "hidden";
        } else {
            debutTourJoueur();
        }
    }
}

function debutTourJoueur() {
    document.getElementById("ecran-passe").style.display = "none";
    document.getElementById("table-de-jeu").style.visibility = "visible";
    document.getElementById("zone-joueur").style.visibility = "visible";
    
    const j = joueurs[joueurActuel];
    document.getElementById("info-joueur").textContent = `Main de ${j.nom} (${j.main.length} cartes)`;
    
    afficherMainJoueur(j.main);
    mettreAJourUI();
}

function creerImageCarte(carte, estSurTable = false) {
    const img = document.createElement("img");
    img.classList.add(estSurTable ? "carte-table" : "carte");
    
    if (carte.valeur === 'joker') {
        // On utilise l'image du joker attribuée à la création du deck
        img.src = carte.image || 'cartes/jokers/red joker.png'; 
        img.classList.add("joker");
        img.alt = "Joker";
    } else {
        let valAnglaise = tradValeurs[carte.valeur] || carte.valeur; 
        let coulAnglaise = tradCouleurs[carte.couleur];
        img.src = `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`; 
        img.alt = `${carte.valeur} de ${carte.couleur}`;
    }
    return img;
}

let draggedCardIndex = null;

function afficherMainJoueur(main) {
    conteneurMain.innerHTML = "";
    
    main.forEach((carte, index) => {
        const img = creerImageCarte(carte);
        img.setAttribute("draggable", "true");
        img.dataset.index = index;

        img.addEventListener("click", () => {
            if (!mancheTerminee && !joueurs[joueurActuel].isIA) {
                img.classList.toggle("selectionnee");
                jouerSon(sonPiocher);
            }
        });

        img.addEventListener("dragstart", function(e) {
            if (mancheTerminee || joueurs[joueurActuel].isIA) return;
            draggedCardIndex = index;
            setTimeout(() => this.style.opacity = '0.4', 0); 
        });

        img.addEventListener("dragend", function() { this.style.opacity = '1'; });
        img.addEventListener("dragover", function(e) { e.preventDefault(); });

        img.addEventListener("drop", function(e) {
            e.preventDefault();
            if (draggedCardIndex === null || draggedCardIndex === index) return;
            const mainActuelle = joueurs[joueurActuel].main;
            const carteDeplacee = mainActuelle.splice(draggedCardIndex, 1)[0];
            mainActuelle.splice(index, 0, carteDeplacee);
            draggedCardIndex = null;
            afficherMainJoueur(mainActuelle); 
        });

        conteneurMain.appendChild(img);
    });
}

function afficherTable() {
    combinaisonsHTML.innerHTML = "";
    combinaisonsTable.forEach((combinaison) => {
        const divGroupe = document.createElement("div");
        divGroupe.classList.add("combinaison-groupe");
        
        combinaison.forEach(carte => {
            const img = creerImageCarte(carte, true);
            img.addEventListener("click", () => {
                if (!mancheTerminee && !joueurs[joueurActuel].isIA) {
                    img.classList.toggle("selectionnee");
                    jouerSon(sonPiocher);
                }
            });
            divGroupe.appendChild(img);
        });
        combinaisonsHTML.appendChild(divGroupe);
    });
}

function afficherCarteDefausse() {
    defausseHTML.innerHTML = "";
    if (carteDefausseActuelle) defausseHTML.appendChild(creerImageCarte(carteDefausseActuelle));
}

function mettreAJourUI() {
    document.getElementById("compteur-pioche").textContent = deck.length;
    
    if (!mancheTerminee && joueurs[joueurActuel] && !joueurs[joueurActuel].isIA) {
        const j = joueurs[joueurActuel];
        btnPiocher.disabled = j.aPioche;
        btnDefausser.disabled = !j.aPioche;
        btnPoser.disabled = !j.aPioche; 
        btnVoler.disabled = !j.aPioche || !j.aPose; 
    } else {
        btnPiocher.disabled = true;
        btnDefausser.disabled = true;
        btnPoser.disabled = true;
        btnVoler.disabled = true;
    }
}

// ==========================================
// RÈGLES ET COMBINAISONS (AVEC JOKERS)
// ==========================================
function calculerPointsCarte(carte) {
    if (carte.valeur === 'joker') return 0;
    if (carte.valeur === 'as') return 11;
    if (['valet', 'dame', 'roi'].includes(carte.valeur)) return 10;
    return parseInt(carte.valeur);
}

function calculerPointsMain(main) {
    return main.reduce((sum, c) => sum + calculerPointsCarte(c), 0);
}

function estUnBrelan(cartes) {
    if (cartes.length < 3 || cartes.length > 4) return false;
    let jokers = cartes.filter(c => c.valeur === 'joker');
    let reelles = cartes.filter(c => c.valeur !== 'joker');
    
    if (jokers.length > cartes.length - 2) return false;
    if (reelles.length === 0) return false;

    let val = reelles[0].valeur;
    if (!reelles.every(c => c.valeur === val)) return false;
    
    let couleursSet = new Set(reelles.map(c => c.couleur));
    if (couleursSet.size !== reelles.length) return false;
    
    return true;
}

function estUneTierce(cartes) {
    if (cartes.length < 3 || cartes.length > 14) return false;
    const nbJokers = cartes.filter(c => c.valeur === 'joker').length;
    const reelles = cartes.filter(c => c.valeur !== 'joker');

    if (nbJokers > cartes.length - 2) return false;
    if (reelles.length === 0) return false;
    if (!reelles.every(c => c.couleur === reelles[0].couleur)) return false;

    // valeurAs = 0 (As bas : As-2-3) ou 13 (As haut : D-R-As)
    const essayer = (valeurAs) => {
        const rangs = reelles
            .map(c => c.valeur === 'as' ? valeurAs : valeurs.indexOf(c.valeur))
            .sort((a, b) => a - b);
        for (let i = 0; i < rangs.length - 1; i++) if (rangs[i] === rangs[i + 1]) return false;
        const trous = (rangs[rangs.length - 1] - rangs[0] + 1) - rangs.length;
        const jokersRestants = nbJokers - trous;
        const marge = rangs[0] + (13 - rangs[rangs.length - 1]); // place pour prolonger la suite
        return trous <= nbJokers && jokersRestants <= marge;
    };
    return essayer(0) || essayer(13);
}

function estCombinaisonValide(cartes) {
    return estUnBrelan(cartes) || estUneTierce(cartes);
}

let compteurRechercheCombinaisons = 0;

function chercherPartition(pool, jokersDispo) {
    if (pool.length === 0) return jokersDispo.length === 0 ? [] : null;
    if (++compteurRechercheCombinaisons > 300000) return null; // sécurité anti-blocage

    const x = pool[0];
    const reste = pool.slice(1);
    const candidates = reste.filter(c => c.valeur === x.valeur || c.couleur === x.couleur);
    const n = candidates.length;

    for (let mask = 0; mask < (1 << n); mask++) {
        const sub = [x];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) sub.push(candidates[i]);
        if (sub.length > 14) continue;

        for (let nj = 0; nj <= jokersDispo.length; nj++) {
            const groupe = [...sub, ...jokersDispo.slice(0, nj)];
            if (groupe.length < 3 || !estCombinaisonValide(groupe)) continue;
            const restePool = reste.filter(c => !sub.includes(c));
            const suite = chercherPartition(restePool, jokersDispo.slice(nj));
            if (suite) return [groupe, ...suite];
        }
    }
    return null;
}

// Si la sélection complète n'est pas posable, on cherche le meilleur sous-ensemble valide
// (en retirant 1 puis 2 cartes qui ne servent à rien) pour ne pas bloquer le joueur.
function trouverMeilleurSousEnsemble(cartes) {
    const n = cartes.length;
    if (n > 16) return null;
    let meilleur = null, meilleurPts = -1;
    const pts = (g) => g.reduce((s, grp) => s + grp.reduce((t, c) => t + calculerPointsCarte(c), 0), 0);
    const essayer = (aEnlever) => {
        const reste = cartes.filter((_, i) => !aEnlever.includes(i));
        if (reste.length < 3) return;
        const g = decouperEnCombinaisons(reste);
        if (g) {
            const p = pts(g);
            if (p > meilleurPts) { meilleurPts = p; meilleur = { groupes: g, cartes: reste }; }
        }
    };
    for (let i = 0; i < n; i++) essayer([i]);
    if (!meilleur) for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) essayer([i, k]);
    return meilleur;
}

function decouperEnCombinaisons(cartes) {
    const jokers = cartes.filter(c => c.valeur === 'joker');
    const reelles = cartes.filter(c => c.valeur !== 'joker');
    reelles.sort((a, b) => {
        if (a.couleur === b.couleur) return valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur);
        return couleurs.indexOf(a.couleur) - couleurs.indexOf(b.couleur);
    });
    compteurRechercheCombinaisons = 0;
    return chercherPartition(reelles, jokers);
}

// ==========================================
// ACTIONS DU JOUEUR
// ==========================================
btnPiocher.addEventListener("click", () => {
    const j = joueurs[joueurActuel];
    if (j.aPioche || mancheTerminee || j.isIA) return;
    
    let nouvelleCarte = piocherDansLeDeck();
    if (!nouvelleCarte) return; 
    j.main.push(nouvelleCarte);
    j.aPioche = true;
    afficherMainJoueur(j.main);
    mettreAJourUI();
    jouerSon(sonPiocher);
});

defausseHTML.addEventListener("click", () => {
    const j = joueurs[joueurActuel];
    if (j.aPioche || mancheTerminee || !carteDefausseActuelle || j.isIA) return;
    
    if (!j.aPose) {
        let mainTest = [...j.main, carteDefausseActuelle];
        if (calculerPointsMain(mainTest) < 51) {
            return alert("Vous ne pouvez prendre la défausse que si elle vous permet de faire vos 51 points !");
        }
    }
    j.main.push(carteDefausseActuelle);
    carteDefausseActuelle = null; 
    j.aPioche = true; 
    afficherCarteDefausse();
    afficherMainJoueur(j.main);
    mettreAJourUI();
    jouerSon(sonPiocher);
});

btnPoser.addEventListener("click", () => {
    const j = joueurs[joueurActuel];
    if (mancheTerminee || j.isIA) return;
    
    const cartesSelectionneesHTML = document.querySelectorAll('#main-joueur .carte.selectionnee');
    const carteTableHTML = document.querySelector('.carte-table.selectionnee');

    if (cartesSelectionneesHTML.length === 0 && !carteTableHTML) return alert("Sélectionnez des cartes.");

    let cartesHand = [];
    cartesSelectionneesHTML.forEach(imgHTML => {
        const carteObj = j.main[parseInt(imgHTML.dataset.index)];
        if (carteObj && !cartesHand.includes(carteObj)) cartesHand.push(carteObj);
    });

    if (carteTableHTML) {
        if (!j.aPose) return alert("Vous devez d'abord faire votre ouverture de 51 points pour compléter la table !");
        if (cartesHand.length === 0) return alert("Sélectionnez les cartes de votre main que vous voulez ajouter.");

        const altTable = carteTableHTML.alt;
        let combIndex = -1;
        combinaisonsTable.forEach((comb, i) => {
            if (comb.some(c => (c.valeur==='joker' && altTable==='Joker') || `${c.valeur} de ${c.couleur}` === altTable)) combIndex = i;
        });

        if (combIndex !== -1) {
            let nouvelleComb = [...combinaisonsTable[combIndex], ...cartesHand];
            if (estCombinaisonValide(nouvelleComb)) {
                combinaisonsTable[combIndex] = nouvelleComb;
                cartesHand.forEach(c => j.main.splice(j.main.indexOf(c), 1));
                afficherMainJoueur(j.main);
                afficherTable();
                mettreAJourUI();
                jouerSon(sonPoser);
                return; 
            } else {
                return alert("Impossible de compléter : ces cartes ne s'ajoutent pas à cette combinaison.");
            }
        }
    }

    if (cartesHand.length === 0) return;
    let cartesAPoser = cartesHand;
    let groupes = decouperEnCombinaisons(cartesHand);
    let nonUtilisees = 0;
    if (!groupes) {
        // Une carte en trop dans la sélection ne doit pas bloquer : on pose ce qui est valide
        const sous = trouverMeilleurSousEnsemble(cartesHand);
        if (!sous) return alert("Ces cartes ne forment pas de combinaison valide.\nBrelan : 3 ou 4 cartes de même valeur et de couleurs différentes.\nTierce : 3 cartes ou plus qui se suivent dans la même couleur.");
        groupes = sous.groupes;
        cartesAPoser = sous.cartes;
        nonUtilisees = cartesHand.length - cartesAPoser.length;
    }

    let pointsTotal = groupes.reduce((sum, grp) => sum + grp.reduce((s, c) => s + calculerPointsCarte(c), 0), 0);

    // Ouverture : 51 points MINIMUM (51 ou plus est accepté)
    if (!j.aPose && pointsTotal < 51) {
        return alert(`Total : ${pointsTotal} pts. Il en faut au moins 51 pour ouvrir.`);
    }

    j.aPose = true;
    cartesAPoser.forEach(carte => j.main.splice(j.main.indexOf(carte), 1));
    groupes.forEach(grp => combinaisonsTable.push(grp));
    
    afficherMainJoueur(j.main);
    afficherTable();
    mettreAJourUI();
    jouerSon(sonPoser);
    if (nonUtilisees > 0) alert(`${nonUtilisees} carte(s) ne faisaient partie d'aucune combinaison : elles restent dans votre main.`);
});

btnVoler.addEventListener("click", () => {
    const j = joueurs[joueurActuel];
    if (mancheTerminee || j.isIA) return;
    
    const cartesTableHTML = document.querySelectorAll('.carte-table.selectionnee');
    const cartesMainHTML = document.querySelectorAll('#main-joueur .carte.selectionnee');
    
    if (cartesTableHTML.length === 0 || cartesMainHTML.length === 0) {
        return alert("Sélectionnez une ou plusieurs cartes sur la table ET de votre main.");
    }

    // --- CORRECTION ICI : On vérifie TOUTES les cartes sélectionnées ---
    for (let imgHTML of cartesTableHTML) {
        if (imgHTML.alt === 'Joker') {
            return alert("Impossible de voler un joker !");
        }
    }

    let combIndex = -1;
    let cartesVolees = [];
    let multiComb = false;

    cartesTableHTML.forEach(imgHTML => {
        const alt = imgHTML.alt;
        combinaisonsTable.forEach((comb, i) => {
            const c = comb.find(c => `${c.valeur} de ${c.couleur}` === alt);
            if (c) {
                if (combIndex !== -1 && combIndex !== i) multiComb = true;
                combIndex = i;
                cartesVolees.push(c);
            }
        });
    });

    if (multiComb) return alert("Vous ne pouvez voler que dans une seule combinaison à la fois.");
    
    const reste = combinaisonsTable[combIndex].length - cartesVolees.length;
    if (reste < 3) {
        return alert(`Il doit rester au moins 3 cartes sur la table (max vol : ${combinaisonsTable[combIndex].length - 3}).`);
    }

    let cartesMain = [];
    cartesMainHTML.forEach(imgHTML => {
        const c = j.main[parseInt(imgHTML.dataset.index)];
        if (c && !cartesMain.includes(c)) cartesMain.push(c);
    });

    let nouvelleCombinaison = [...cartesMain, ...cartesVolees];
    if (!decouperEnCombinaisons(nouvelleCombinaison)) return alert("La nouvelle combinaison formée est invalide.");

    cartesVolees.forEach(c => {
        const idx = combinaisonsTable[combIndex].indexOf(c);
        if (idx !== -1) combinaisonsTable[combIndex].splice(idx, 1);
    });
    cartesMain.forEach(c => j.main.splice(j.main.indexOf(c), 1));
    combinaisonsTable.push(nouvelleCombinaison);

    afficherMainJoueur(j.main);
    afficherTable();
    mettreAJourUI();
    jouerSon(sonPoser);
});

btnDefausser.addEventListener("click", () => {
    const j = joueurs[joueurActuel];
    if (!j.aPioche || mancheTerminee || j.isIA) return;
    
    const carteSelectionneeHTML = document.querySelector('#main-joueur .carte.selectionnee');
    if (!carteSelectionneeHTML) return alert("Sélectionnez une carte à jeter.");
    
    const altCarte = carteSelectionneeHTML.alt;
    const indexCarte = j.main.findIndex(c => (c.valeur==='joker' && altCarte==='Joker') || `${c.valeur} de ${c.couleur}` === altCarte);
    
    if (indexCarte !== -1) {
        carteDefausseActuelle = j.main.splice(indexCarte, 1)[0];
        afficherCarteDefausse();
        afficherMainJoueur(j.main);
        jouerSon(sonPiocher);
        
        if (j.main.length === 0) return finDeManche(joueurActuel);
        passerAuJoueurSuivant();
    }
});

function piocherDansLeDeck() {
    if (deck.length === 0) {
        if (carteDefausseActuelle) {
            let ancienneDefausse = carteDefausseActuelle;
            combinaisonsTable.forEach(comb => deck.push(...comb));
            combinaisonsTable = [];
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            carteDefausseActuelle = ancienneDefausse;
            afficherTable();
            alert("La pioche est vide ! Mélange de la défausse.");
            if (deck.length === 0) { finDeManche(-1); return null; }
        }
    }
    return deck.pop();
}

// ==========================================
// GESTION DES TOURS & IA
// ==========================================
function passerAuJoueurSuivant() {
    premierTourGlobal = false; 
    joueurActuel = (joueurActuel + 1) % joueurs.length;
    joueurs[joueurActuel].aPioche = false;
    preparerTour();
}

function tourIA() {
    const j = joueurs[joueurActuel];
    if (mancheTerminee) return;
    
    const statutDiv = document.getElementById("statut-ia");
    statutDiv.style.display = "block";
    statutDiv.textContent = `${j.nom} réfléchit...`;

    setTimeout(() => {
        let nouvelleCarte = piocherDansLeDeck();
        if (!nouvelleCarte) return;
        j.main.push(nouvelleCarte);
        j.aPioche = true;
        mettreAJourUI();
        jouerSon(sonPiocher);
        statutDiv.textContent = `${j.nom} a pioché une carte...`;

        setTimeout(() => {
            if (!premierTourGlobal || j.aPose) {
                iaJoueCombinaisons(j);
                if (j.aPose) {
                    statutDiv.textContent = `${j.nom} pose des cartes !`;
                    jouerSon(sonPoser);
                }
            }

            setTimeout(() => {
                let carteJetee = iaChoisitCarteAJeter(j);
                j.main.splice(j.main.indexOf(carteJetee), 1);
                carteDefausseActuelle = carteJetee;
                
                afficherCarteDefausse();
                afficherTable();
                jouerSon(sonPiocher);
                statutDiv.textContent = `${j.nom} a défaussé.`;
                
                setTimeout(() => {
                    statutDiv.style.display = "none";
                    if (j.main.length === 0) return finDeManche(joueurActuel);
                    passerAuJoueurSuivant();
                }, 1000);

            }, 1500);
        }, 1500);
    }, 1500);
}

function iaTrouveCombinaisons(main) {
    let combinaisons = [];
    for (let val of valeurs) {
        let cartesMemeValeur = main.filter(c => c.valeur === val);
        let uniques = [];
        let couleursVues = new Set();
        for (let c of cartesMemeValeur) {
            if (!couleursVues.has(c.couleur)) { uniques.push(c); couleursVues.add(c.couleur); }
        }
        if (uniques.length >= 3) combinaisons.push(uniques.slice(0, uniques.length)); 
    }
    for (let coul of couleurs) {
        let cartesCouleur = main.filter(c => c.couleur === coul);
        cartesCouleur.sort((a, b) => valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur));
        let suiteActuelle = [];
        for (let i = 0; i < cartesCouleur.length; i++) {
            if (suiteActuelle.length === 0) suiteActuelle.push(cartesCouleur[i]);
            else {
                let derniere = suiteActuelle[suiteActuelle.length - 1];
                let idxActuel = valeurs.indexOf(cartesCouleur[i].valeur);
                let idxPrec = valeurs.indexOf(derniere.valeur);
                if (idxActuel === idxPrec + 1) suiteActuelle.push(cartesCouleur[i]);
                else if (idxActuel > idxPrec + 1) {
                    if (suiteActuelle.length >= 3) combinaisons.push([...suiteActuelle]);
                    suiteActuelle = [cartesCouleur[i]];
                }
            }
        }
        if (suiteActuelle.length >= 3) combinaisons.push([...suiteActuelle]);
    }

    let jokers = main.filter(c => c.valeur === 'joker');
    for (let joker of jokers) {
        for (let comb of combinaisons) {
            if (comb.length === 3 && !comb.some(c => c.valeur === 'joker')) {
                let testComb = [...comb, joker];
                if (estUnBrelan(testComb) || estUneTierce(testComb)) {
                    comb.push(joker);
                    break;
                }
            }
        }
    }
    return combinaisons;
}

function iaJoueCombinaisons(j) {
    let combinaisonsPossibles = iaTrouveCombinaisons(j.main);
    if (combinaisonsPossibles.length === 0) return;

    if (!j.aPose) {
        let brelans = combinaisonsPossibles.filter(c => estUnBrelan(c));
        let tierces = combinaisonsPossibles.filter(c => estUneTierce(c));

        if (brelans.length > 0 && tierces.length > 0) {
            brelans.sort((a, b) => b.reduce((s, c) => s + calculerPointsCarte(c), 0) - a.reduce((s, c) => s + calculerPointsCarte(c), 0));
            tierces.sort((a, b) => b.reduce((s, c) => s + calculerPointsCarte(c), 0) - a.reduce((s, c) => s + calculerPointsCarte(c), 0));
            
            let aPoser = [brelans[0], tierces[0]];
            let points = aPoser[0].reduce((s, c) => s + calculerPointsCarte(c), 0) + aPoser[1].reduce((s, c) => s + calculerPointsCarte(c), 0);
            
            let restantes = [...brelans.slice(1), ...tierces.slice(1)];
            restantes.sort((a, b) => b.reduce((s, c) => s + calculerPointsCarte(c), 0) - a.reduce((s, c) => s + calculerPointsCarte(c), 0));
            
            for (let comb of restantes) {
                if (points >= 51) break;
                aPoser.push(comb);
                points += comb.reduce((s, c) => s + calculerPointsCarte(c), 0);
            }
            
            if (points >= 51) {
                aPoser.forEach(comb => {
                    comb.forEach(c => j.main.splice(j.main.indexOf(c), 1));
                    combinaisonsTable.push(comb);
                });
                j.aPose = true;
                afficherTable();
            }
        }
    } else {
        combinaisonsPossibles.forEach(comb => {
            comb.forEach(c => j.main.splice(j.main.indexOf(c), 1));
            combinaisonsTable.push(comb);
        });
        afficherTable();
    }
}

function iaChoisitCarteAJeter(j) {
    let combinaisonsPossibles = iaTrouveCombinaisons(j.main);
    let cartesUtiles = [];
    combinaisonsPossibles.forEach(comb => comb.forEach(c => cartesUtiles.push(c)));
    
    let cartesInutiles = j.main.filter(c => !cartesUtiles.includes(c) && c.valeur !== 'joker');
    if (cartesInutiles.length === 0 && niveauDifficulte !== 'facile') {
        cartesInutiles = j.main.filter(c => !cartesUtiles.includes(c));
    }

    if (cartesInutiles.length > 0) {
        if (niveauDifficulte === 'facile') return cartesInutiles[0];
        else if (niveauDifficulte === 'moyen') return cartesInutiles.sort((a, b) => calculerPointsCarte(a) - calculerPointsCarte(b))[0];
        else return cartesInutiles.sort((a, b) => calculerPointsCarte(b) - calculerPointsCarte(a))[0];
    }
    return j.main.sort((a, b) => calculerPointsCarte(a) - calculerPointsCarte(b))[0];
}

// ==========================================
// FIN DE MANCHE
// ==========================================
function finDeManche(indexGagnant) {
    mancheTerminee = true;
    mettreAJourUI();
    document.getElementById("zone-joueur").style.visibility = "visible";

    let details = "";
    let gagnantNom = indexGagnant !== -1 ? joueurs[indexGagnant].nom : "Personne";
    
    joueurs.forEach((j, i) => {
        if (i === indexGagnant) {
            j.score += 0;
        } else {
            let pts = calculerPointsMain(j.main);
            if (!j.aPose) pts = 100; 
            j.score += pts;
            details += `${j.nom} a marqué : ${pts} pts<br>`;
        }
    });

    afficherScores();

    let titre = indexGagnant !== -1 ? `${gagnantNom} a gagné la manche ! 🎉` : "Manche bloquée !";
    if (indexGagnant === 0) jouerSon(sonVictoire);
    else if (indexGagnant === -1 || indexGagnant > 0) jouerSon(sonDefaite);

    let finPartie = joueurs.some(j => j.score >= 100);
    
    if (finPartie) {
        titre = "Fin de la partie !";
        document.getElementById("btn-suivant").textContent = "Rejouer une partie";
        document.getElementById("btn-suivant").onclick = () => location.reload();
        details += "<br><strong>Quelqu'un a atteint 100 points ! La partie est terminée.</strong>";
    } else {
        document.getElementById("btn-suivant").textContent = "Manche Suivante";
        document.getElementById("btn-suivant").onclick = () => demarrerManche();
    }

    document.getElementById("titre-victoire").textContent = titre;
    document.getElementById("texte-victoire").innerHTML = "";
    document.getElementById("detail-points").innerHTML = details;
    document.getElementById("ecran-victoire").style.display = "flex";
}

// ==========================================
// INTERFACE
// ==========================================
document.getElementById("btn-son").addEventListener("click", function() {
    estMuet = !estMuet;
    this.textContent = estMuet ? "🔇" : "🔊";
});

document.getElementById("btn-fullscreen").addEventListener("click", function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        this.textContent = "✖";
    } else {
        document.exitFullscreen();
        this.textContent = "⛶";
    }
});

const modalRegles = document.getElementById("modal-regles");
document.getElementById("btn-regles").addEventListener("click", () => modalRegles.style.display = "flex");
document.getElementById("btn-fermer-regles").addEventListener("click", () => modalRegles.style.display = "none");