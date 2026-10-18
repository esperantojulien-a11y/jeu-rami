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

let joueurs = []; // Tableau qui contiendra tous les joueurs
let joueurActuel = 0; // Index du joueur en cours
let premierTourGlobal = true; 
let mancheTerminee = false;

// Paramètres de partie
let nbJoueursTotal = 1;
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
    
    // Si c'est du multi-joueurs, on cache la difficulté de l'IA
    document.getElementById("section-difficulte").style.display = (nb === 1) ? "block" : "none";
}

function setDifficulte(niveau) {
    niveauDifficulte = niveau;
    ['facile', 'moyen', 'difficile'].forEach(n => document.getElementById(`btn-${n}`).classList.remove('actif'));
    document.getElementById(`btn-${niveau}`).classList.add('actif');
}

function lancerPartie() {
    document.getElementById("ecran-accueil").style.display = "none";
    document.getElementById("table-de-jeu").style.display = "flex";
    
    // Création des joueurs
    joueurs = [];
    for (let i = 0; i < nbJoueursTotal; i++) {
        joueurs.push({
            id: i,
            nom: `Joueur ${i + 1}`,
            main: [],
            score: 0,
            aPose: false,
            isIA: false
        });
    }
    
    // Si 1 seul joueur, on ajoute l'IA
    if (nbJoueursTotal === 1) {
        joueurs.push({ id: 1, nom: "L'IA", main: [], score: 0, aPose: false, isIA: true });
        document.getElementById("adversaires").innerHTML = `<div class="profil-adversaire"><div class="avatar">🤖</div><div class="infos-adversaire"><h3>L'IA <span>(${niveauDifficulte})</span></h3><p id="info-ordi">13 cartes</p></div></div>`;
    } else {
        document.getElementById("adversaires").innerHTML = `<div class="profil-adversaire"><div class="avatar">👥</div><div class="infos-adversaire"><h3>Partie à ${nbJoueursTotal} joueurs</h3><p>Sur le même écran</p></div></div>`;
    }

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
    joueurActuel = 0;
    
    joueurs.forEach(j => { j.main = []; j.aPose = false; });
    
    document.getElementById("ecran-victoire").style.display = "none";
    
    creerDeck();
    distribuerCartes();
    afficherScores();
    preparerTour();
}

function creerDeck() {
    deck = [];
    for (let i = 0; i < 2; i++) {
        for (let couleur of couleurs) {
            for (let valeur of valeurs) {
                deck.push({ valeur: valeur, couleur: couleur });
            }
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function distribuerCartes() {
    for (let i = 0; i < 13; i++) {
        joueurs.forEach(j => j.main.push(deck.pop()));
    }
    
    // On trie la main de chaque joueur UNE SEULE FOIS au début
    joueurs.forEach(j => {
        j.main.sort((a, b) => {
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

// ==========================================
// TOUR PAR TOUR
// ==========================================
function preparerTour() {
    afficherScores();
    const j = joueurs[joueurActuel];
    
    if (j.isIA) {
        document.getElementById("zone-joueur").style.visibility = "hidden";
        setTimeout(tourIA, 1500);
    } else {
        // Si c'est un joueur humain et qu'il y a plusieurs joueurs, on affiche l'écran de passage
        if (nbJoueursTotal > 1) {
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

// ==========================================
// AFFICHAGE
// ==========================================
function creerImageCarte(carte, estSurTable = false) {
    const img = document.createElement("img");
    img.classList.add(estSurTable ? "carte-table" : "carte");
    let valAnglaise = tradValeurs[carte.valeur] || carte.valeur; 
    let coulAnglaise = tradCouleurs[carte.couleur];
    img.src = `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`; 
    img.alt = `${carte.valeur} de ${carte.couleur}`;
    return img;
}

// Variable globale pour mémoriser la carte en cours de déplacement
let draggedCardIndex = null;

function afficherMainJoueur(main) {
    conteneurMain.innerHTML = "";
    
    // Plus de tri automatique ici ! On respecte l'ordre du tableau.

    main.forEach((carte, index) => {
        const img = creerImageCarte(carte);
        
        // On rend l'image "attrapable"
        img.setAttribute("draggable", "true");
        img.dataset.index = index;

        // Clic normal (sélectionner pour poser)
        img.addEventListener("click", () => {
            if (!mancheTerminee) {
                img.classList.toggle("selectionnee");
                jouerSon(sonPiocher);
            }
        });

        // --- LOGIQUE DU GLISSER-DÉPOSER ---
        img.addEventListener("dragstart", function(e) {
            if (mancheTerminee) return;
            draggedCardIndex = index;
            // Petit effet visuel : la carte devient transparente quand on la tire
            setTimeout(() => this.style.opacity = '0.4', 0); 
        });

        img.addEventListener("dragend", function(e) {
            this.style.opacity = '1'; // On remet l'opacité normale
        });

        img.addEventListener("dragover", function(e) {
            e.preventDefault(); // Indispensable pour autoriser le dépôt
        });

        img.addEventListener("drop", function(e) {
            e.preventDefault();
            if (draggedCardIndex === null || draggedCardIndex === index) return;

            // On échange la carte de place dans le tableau
            const mainActuelle = joueurs[joueurActuel].main;
            const carteDeplacee = mainActuelle.splice(draggedCardIndex, 1)[0];
            mainActuelle.splice(index, 0, carteDeplacee);

            draggedCardIndex = null;
            afficherMainJoueur(mainActuelle); // On redessine la main dans le nouvel ordre
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
                if (!mancheTerminee) {
                    if(combinaison.length > 3) {
                        document.querySelectorAll('.carte-table').forEach(c => c.classList.remove('selectionnee'));
                        img.classList.add("selectionnee");
                        jouerSon(sonPiocher);
                    } else {
                        alert("Impossible de voler : cette combinaison n'a que 3 cartes.");
                    }
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
    
    if (!mancheTerminee && joueurs[joueurActuel]) {
        const j = joueurs[joueurActuel];
        // On gère l'état des boutons (simplifié ici car géré en interne par les fonctions)
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
// RÈGLES ET COMBINAISONS
// ==========================================
function calculerPointsCarte(carte, estDernierDeSuite = false) {
    if (carte.valeur === 'as') return estDernierDeSuite ? 11 : 1;
    if (['valet', 'dame', 'roi'].includes(carte.valeur)) return 10;
    return parseInt(carte.valeur);
}

function calculerPointsMain(main) {
    return main.reduce((sum, c) => sum + calculerPointsCarte(c), 0);
}

function estUnBrelan(cartes) {
    if (cartes.length < 3 || cartes.length > 4) return false;
    return cartes.every(c => c.valeur === cartes[0].valeur) && new Set(cartes.map(c => c.couleur)).size === cartes.length;
}

function estUneTierce(cartes) {
    if (cartes.length < 3) return false;
    if (!cartes.every(c => c.couleur === cartes[0].couleur)) return false;
    let cartesTriées = [...cartes].sort((a, b) => valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur));
    if (cartesTriées.length === 3 && cartesTriées[0].valeur === 'dame' && cartesTriées[1].valeur === 'roi' && cartesTriées[2].valeur === 'as') return true;
    if (cartesTriées[cartesTriées.length-1].valeur === 'as') return false; 
    for (let i = 0; i < cartesTriées.length - 1; i++) {
        if (valeurs.indexOf(cartesTriées[i+1].valeur) - valeurs.indexOf(cartesTriées[i].valeur) !== 1) return false;
    }
    return true;
}
function estCombinaisonValide(cartes) {
    return estUnBrelan(cartes) || estUneTierce(cartes);
}

function decouperEnCombinaisons(cartes) {
    let pool = [...cartes];
    let groupes = [];

    pool.sort((a, b) => {
        if (a.couleur === b.couleur) return valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur);
        return couleurs.indexOf(a.couleur) - couleurs.indexOf(b.couleur);
    });

    let aTrouve = true;
    while (aTrouve) {
        aTrouve = false;
        // 1. Chercher les suites
        for (let coul of couleurs) {
            let cartesCoul = pool.filter(c => c.couleur === coul);
            if (cartesCoul.length >= 3) {
                for (let i = 0; i <= cartesCoul.length - 3; i++) {
                    let suite = [cartesCoul[i]];
                    for (let j = i + 1; j < cartesCoul.length; j++) {
                        if (valeurs.indexOf(cartesCoul[j].valeur) === valeurs.indexOf(suite[suite.length - 1].valeur) + 1) {
                            suite.push(cartesCoul[j]);
                        } else if (suite.length === 3 && suite[0].valeur === 'dame' && suite[1].valeur === 'roi' && cartesCoul[j].valeur === 'as') {
                            suite.push(cartesCoul[j]);
                        } else {
                            break;
                        }
                    }
                    if (suite.length >= 3) {
                        groupes.push(suite);
                        suite.forEach(c => pool.splice(pool.indexOf(c), 1));
                        aTrouve = true;
                        break;
                    }
                }
            }
            if (aTrouve) break;
        }
        if (aTrouve) continue;

        // 2. Chercher les brelans (SANS DOUBLON DE COULEUR)
        for (let val of valeurs) {
            let memeValeur = pool.filter(c => c.valeur === val);
            let uniques = [];
            let couleursVues = new Set();
            for (let c of memeValeur) {
                if (!couleursVues.has(c.couleur)) {
                    uniques.push(c);
                    couleursVues.add(c.couleur);
                }
            }
            if (uniques.length >= 3) {
                let brelan = uniques.slice(0, 3);
                groupes.push(brelan);
                brelan.forEach(c => pool.splice(pool.indexOf(c), 1));
                aTrouve = true;
                break;
            }
        }
    }
    if (pool.length > 0) return null; 
    return groupes;
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
    if (premierTourGlobal || mancheTerminee || j.isIA) return;
    
    const cartesSelectionneesHTML = document.querySelectorAll('#main-joueur .carte.selectionnee');
    const carteTableHTML = document.querySelector('.carte-table.selectionnee');

    if (cartesSelectionneesHTML.length === 0 && !carteTableHTML) return alert("Sélectionnez des cartes.");

    let cartesHand = [];
    cartesSelectionneesHTML.forEach(imgHTML => {
        const carteObj = j.main.find(c => `${c.valeur} de ${c.couleur}` === imgHTML.alt);
        if (carteObj) cartesHand.push(carteObj);
    });

    // CAS 1 : COMPLÉTER UNE COMBINAISON EXISTANTE
    if (carteTableHTML) {
        if (!j.aPose) return alert("Vous devez d'abord faire votre ouverture de 51 points pour compléter la table !");
        if (cartesHand.length === 0) return alert("Sélectionnez les cartes de votre main que vous voulez ajouter.");

        const altTable = carteTableHTML.alt;
        let combIndex = -1;
        
        combinaisonsTable.forEach((comb, i) => {
            if (comb.some(c => `${c.valeur} de ${c.couleur}` === altTable)) combIndex = i;
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

    // CAS 2 : POSER UNE NOUVELLE COMBINAISON
    if (cartesHand.length === 0) return;
    let groupes = decouperEnCombinaisons(cartesHand);
    if (!groupes) return alert("Combinaison invalide.");

    let pointsTotal = groupes.reduce((sum, grp) => sum + grp.reduce((s, c) => s + calculerPointsCarte(c), 0), 0);

    // RÈGLE STRICTE D'OUVERTURE
    if (!j.aPose) {
        if (pointsTotal < 51) return alert(`Total : ${pointsTotal} pts. Il en faut 51.`);
        
        let aUnBrelan = groupes.some(grp => estUnBrelan(grp));
        let aUneTierce = groupes.some(grp => estUneTierce(grp));
        
        if (!aUnBrelan || !aUneTierce) {
            return alert("Règle de Jacqueline : pour ouvrir, il faut obligatoirement au moins UNE tierce ET UN brelan !");
        }
    }

    j.aPose = true;
    cartesHand.forEach(carte => j.main.splice(j.main.indexOf(carte), 1));
    groupes.forEach(grp => combinaisonsTable.push(grp));
    
    afficherMainJoueur(j.main);
    afficherTable();
    mettreAJourUI();
    jouerSon(sonPoser);
});

btnVoler.addEventListener("click", () => {
    const j = joueurs[joueurActuel];
    if (mancheTerminee || j.isIA) return;
    
    const carteTableHTML = document.querySelector('.carte-table.selectionnee');
    const cartesMainHTML = document.querySelectorAll('#main-joueur .carte.selectionnee');
    if (!carteTableHTML || cartesMainHTML.length === 0) return alert("Sélectionnez une carte sur la table ET de votre main.");

    const altCarteVolee = carteTableHTML.alt;
    let carteVolee = null, indexCombinaison = -1;
    combinaisonsTable.forEach((comb, i) => {
        const c = comb.find(c => `${c.valeur} de ${c.couleur}` === altCarteVolee);
        if (c) { carteVolee = c; indexCombinaison = i; }
    });

    let cartesMain = [];
    cartesMainHTML.forEach(imgHTML => {
        const c = j.main.find(c => `${c.valeur} de ${c.couleur}` === imgHTML.alt);
        if (c) cartesMain.push(c);
    });

    let nouvelleCombinaison = [...cartesMain, carteVolee];
    if (!decouperEnCombinaisons(nouvelleCombinaison)) return alert("Nouvelle combinaison invalide.");
    if (combinaisonsTable[indexCombinaison].length - 1 < 3) return alert("Pas assez de cartes sur la table.");

    combinaisonsTable[indexCombinaison].splice(combinaisonsTable[indexCombinaison].indexOf(carteVolee), 1);
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
    const indexCarte = j.main.findIndex(c => `${c.valeur} de ${c.couleur}` === altCarte);
    
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

// IA Tour (Uniquement si 1 joueur)
function tourIA() {
    const j = joueurs[joueurActuel];
    if (mancheTerminee) return;
    
    let nouvelleCarte = piocherDansLeDeck();
    if (!nouvelleCarte) return;
    j.main.push(nouvelleCarte);
    mettreAJourUI();

    setTimeout(() => {
        if (!premierTourGlobal || j.aPose) {
            iaJoueCombinaisons(j);
        }

        setTimeout(() => {
            let carteJetee = iaChoisitCarteAJeter(j);
            j.main.splice(j.main.indexOf(carteJetee), 1);
            carteDefausseActuelle = carteJetee;
            
            afficherCarteDefausse();
            afficherTable();
            
            if (j.main.length === 0) return finDeManche(joueurActuel);
            passerAuJoueurSuivant();
        }, 1000);
    }, 1000);
}

function iaTrouveCombinaisons(main) {
    let combinaisons = [];
    // Brelans SANS DOUBLON
    for (let val of valeurs) {
        let cartesMemeValeur = main.filter(c => c.valeur === val);
        let uniques = [];
        let couleursVues = new Set();
        for (let c of cartesMemeValeur) {
            if (!couleursVues.has(c.couleur)) {
                uniques.push(c);
                couleursVues.add(c.couleur);
            }
        }
        if (uniques.length >= 3) combinaisons.push(uniques.slice(0, uniques.length)); 
    }
    // Tierces
    for (let coul of couleurs) {
        let cartesCouleur = main.filter(c => c.couleur === coul);
        cartesCouleur.sort((a, b) => valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur));
        let suiteActuelle = [];
        for (let i = 0; i < cartesCouleur.length; i++) {
            if (suiteActuelle.length === 0) {
                suiteActuelle.push(cartesCouleur[i]);
            } else {
                let derniereCarte = suiteActuelle[suiteActuelle.length - 1];
                let indexActuel = valeurs.indexOf(cartesCouleur[i].valeur);
                let indexPrecedent = valeurs.indexOf(derniereCarte.valeur);
                if (indexActuel === indexPrecedent + 1) {
                    suiteActuelle.push(cartesCouleur[i]);
                } else if (indexActuel > indexPrecedent + 1) {
                    if (suiteActuelle.length >= 3) combinaisons.push([...suiteActuelle]);
                    suiteActuelle = [cartesCouleur[i]];
                }
            }
        }
        if (suiteActuelle.length >= 3) combinaisons.push([...suiteActuelle]);
    }
    return combinaisons;
}
function iaJoueCombinaisons(j) {
    let combinaisonsPossibles = iaTrouveCombinaisons(j.main);
    if (combinaisonsPossibles.length === 0) return;

    if (!j.aPose) {
        // L'IA doit OBLIGATOIREMENT avoir 1 brelan et 1 tierce pour ouvrir
        let brelans = combinaisonsPossibles.filter(c => estUnBrelan(c));
        let tierces = combinaisonsPossibles.filter(c => estUneTierce(c));

        if (brelans.length > 0 && tierces.length > 0) {
            // On prend les plus grosses combinaisons
            brelans.sort((a, b) => b.reduce((s, c) => s + calculerPointsCarte(c), 0) - a.reduce((s, c) => s + calculerPointsCarte(c), 0));
            tierces.sort((a, b) => b.reduce((s, c) => s + calculerPointsCarte(c), 0) - a.reduce((s, c) => s + calculerPointsCarte(c), 0));
            
            let combinaisonsA_Poser = [brelans[0], tierces[0]];
            let pointsTotal = combinaisonsA_Poser[0].reduce((s, c) => s + calculerPointsCarte(c), 0) + combinaisonsA_Poser[1].reduce((s, c) => s + calculerPointsCarte(c), 0);
            
            // Si les 2 premières ne font pas 51, on ajoute les suivantes
            let restantes = [...brelans.slice(1), ...tierces.slice(1)];
            restantes.sort((a, b) => b.reduce((s, c) => s + calculerPointsCarte(c), 0) - a.reduce((s, c) => s + calculerPointsCarte(c), 0));
            
            for (let comb of restantes) {
                if (pointsTotal >= 51) break;
                combinaisonsA_Poser.push(comb);
                pointsTotal += comb.reduce((s, c) => s + calculerPointsCarte(c), 0);
            }
            
            // Si on a réussi à faire 51 points avec au moins 1 brelan et 1 tierce :
            if (pointsTotal >= 51) {
                combinaisonsA_Poser.forEach(comb => {
                    comb.forEach(c => j.main.splice(j.main.indexOf(c), 1));
                    combinaisonsTable.push(comb);
                });
                j.aPose = true;
                afficherTable();
            }
        }
    } else {
        // Si l'IA a déjà ouvert, elle pose tout ce qu'elle peut
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
    let cartesInutiles = j.main.filter(c => !cartesUtiles.includes(c));

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
    if (indexGagnant === -1) alert("Pioche vide, on compte les points !");

    joueurs.forEach((j, i) => {
        if (i === indexGagnant) {
            j.score += 0;
        } else {
            let pts = calculerPointsMain(j.main);
            if (!j.aPose) pts = 100; // Règle Jacqueline
            j.score += pts;
            details += `${j.nom} a marqué : ${pts} pts<br>`;
        }
    });

    afficherScores();

    let titre = indexGagnant !== -1 ? `${gagnantNom} a gagné la manche ! 🎉` : "Manche bloquée !";
    if (indexGagnant === joueurActuel && joueurs[joueurActuel].isIA) jouerSon(sonDefaite);
    else if (indexGagnant === joueurActuel) jouerSon(sonVictoire);

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
// INTERFACE (Plein écran, Règles, Son)
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
