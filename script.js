// ==========================================
// GESTION DU SON (AUDIO LOCAL)
// ==========================================
const sonPiocher = new Audio('audio/pioche.ogg');
const sonPoser = new Audio('audio/pose.ogg');
const sonVictoire = new Audio('audio/victoire.ogg');
const sonDefaite = new Audio('audio/defaite.ogg');

let estMuet = false;

function jouerSon(sound) {
    if (estMuet) return;
    sound.currentTime = 0;
    sound.volume = 0.3; // Ajustez entre 0.1 (très bas) et 1.0 (très fort)
    sound.play().catch(e => console.log("Le navigateur a bloqué le son (il faut cliquer sur la page)."));
}

document.addEventListener("DOMContentLoaded", () => {
    const btnSon = document.getElementById("btn-son");
    if(btnSon) {
        btnSon.addEventListener("click", () => {
            estMuet = !estMuet;
            btnSon.textContent = estMuet ? "🔇" : "🔊";
        });
    }
});
// ==========================================

// Variables globales
let deck = [];
let mainJoueur = [];
let mainOrdi = [];
let combinaisonsTable = []; 
let carteDefausseActuelle = null; 

let estTourJoueur = true;
let aPioche = false;
let aPoseOuvertureJoueur = false; 
let aPoseOuvertureOrdi = false;
let premierTourGlobal = true; 

// Variables de progression
let scoreJoueur = 0;
let scoreOrdi = 0;
let niveauDifficulte = 'moyen'; 
let mancheTerminee = false;

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

// --- INITIALISATION ---
function demarrerJeu(niveau) {
    niveauDifficulte = niveau;
    document.getElementById("niveau-actuel").textContent = `(${niveau})`;
    document.getElementById("ecran-accueil").style.display = "none";
    document.getElementById("table-de-jeu").style.display = "flex";
    scoreJoueur = 0; scoreOrdi = 0;
    mettreAJourScores();
    demarrerManche();
}

function demarrerManche() {
    mancheTerminee = false;
    premierTourGlobal = true;
    aPoseOuvertureJoueur = false;
    aPoseOuvertureOrdi = false;
    combinaisonsTable = [];
    combinaisonsHTML.innerHTML = "";
    estTourJoueur = true;
    aPioche = false;
    
    document.getElementById("ecran-victoire").style.display = "none";
    creerDeck();
    distribuerCartes();
    afficherMainJoueur();
    afficherTable();
    mettreAJourUI();
}

function mettreAJourScores() {
    document.getElementById("score-joueur").textContent = scoreJoueur;
    document.getElementById("score-ordi").textContent = scoreOrdi;
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
    mainJoueur = deck.splice(0, 13);
    mainOrdi = deck.splice(0, 13);
    carteDefausseActuelle = deck.pop();
    afficherCarteDefausse();
}

// --- AFFICHAGE ---
function creerImageCarte(carte, estSurTable = false) {
    const img = document.createElement("img");
    img.classList.add(estSurTable ? "carte-table" : "carte");
    let valAnglaise = tradValeurs[carte.valeur] || carte.valeur; 
    let coulAnglaise = tradCouleurs[carte.couleur];
    img.src = `cartes/${coulAnglaise}/${encodeURIComponent(valAnglaise + " of " + coulAnglaise + ".png")}`; 
    img.alt = `${carte.valeur} de ${carte.couleur}`;
    return img;
}

function afficherMainJoueur() {
    conteneurMain.innerHTML = "";
    mainJoueur.sort((a, b) => {
        if (a.couleur === b.couleur) return valeurs.indexOf(a.valeur) - valeurs.indexOf(b.valeur);
        return couleurs.indexOf(a.couleur) - couleurs.indexOf(b.couleur);
    });

    mainJoueur.forEach((carte) => {
        const img = creerImageCarte(carte);
        img.addEventListener("click", () => {
            if(estTourJoueur && !mancheTerminee) {
                img.classList.toggle("selectionnee");
                jouerSon(sonPiocher); // Petit bruit quand on sélectionne
            }
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
                if(estTourJoueur && aPioche && !mancheTerminee) {
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
    document.getElementById("info-joueur").textContent = `Votre main (${mainJoueur.length} cartes)`;
    document.getElementById("info-ordi").textContent = `${mainOrdi.length} cartes`;

    if (estTourJoueur && !mancheTerminee) {
        btnPiocher.disabled = aPioche;
        btnDefausser.disabled = !aPioche;
        btnPoser.disabled = !aPioche; 
        btnVoler.disabled = !aPioche || !aPoseOuvertureJoueur; 
    } else {
        btnPiocher.disabled = true;
        btnDefausser.disabled = true;
        btnPoser.disabled = true;
        btnVoler.disabled = true;
    }
}

// --- RÈGLES DU JEU (JOUEUR) ---
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

// --- ACTIONS DU JOUEUR ---
defausseHTML.addEventListener("click", () => {
    if (!estTourJoueur || aPioche || mancheTerminee || !carteDefausseActuelle) return;
    if (!aPoseOuvertureJoueur) {
        let mainTest = [...mainJoueur, carteDefausseActuelle];
        if (calculerPointsMain(mainTest) < 51) {
            return alert("Vous ne pouvez prendre la défausse que si elle vous permet de faire vos 51 points !");
        }
    }
    mainJoueur.push(carteDefausseActuelle);
    carteDefausseActuelle = null; 
    aPioche = true; 
    afficherCarteDefausse();
    afficherMainJoueur();
    mettreAJourUI();
    jouerSon(sonPiocher); // Son quand on prend la défausse
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
            if (deck.length === 0) { finDeManche('bloque'); return null; }
        }
    }
    return deck.pop();
}

btnPoser.addEventListener("click", () => {
    if (premierTourGlobal || mancheTerminee) return alert("Action impossible.");
    const cartesSelectionneesHTML = document.querySelectorAll('#main-joueur .carte.selectionnee');
    if (cartesSelectionneesHTML.length === 0) return alert("Sélectionnez des cartes.");

    let cartesA_Poser = [];
    cartesSelectionneesHTML.forEach(imgHTML => {
        const carteObj = mainJoueur.find(c => `${c.valeur} de ${c.couleur}` === imgHTML.alt);
        if (carteObj) cartesA_Poser.push(carteObj);
    });

    if (!estCombinaisonValide(cartesA_Poser)) return alert("Combinaison invalide.");

    let pointsTotal = cartesA_Poser.reduce((sum, c) => sum + calculerPointsCarte(c), 0);
    if (pointsTotal < 51 && !aPoseOuvertureJoueur) return alert(`Total : ${pointsTotal} pts. Il en faut 51.`);

    aPoseOuvertureJoueur = true;
    cartesA_Poser.forEach(carte => mainJoueur.splice(mainJoueur.indexOf(carte), 1));
    combinaisonsTable.push(cartesA_Poser);
    
    afficherMainJoueur();
    afficherTable();
    mettreAJourUI();
    jouerSon(sonPoser); // Son de validation
});

btnVoler.addEventListener("click", () => {
    if (mancheTerminee) return;
    const carteTableHTML = document.querySelector('.carte-table.selectionnee');
    const cartesMainHTML = document.querySelectorAll('#main-joueur .carte.selectionnee');
    if (!carteTableHTML || cartesMainHTML.length === 0) return alert("Sélectionnez une carte de la table ET de votre main.");

    const altCarteVolee = carteTableHTML.alt;
    let carteVolee = null, indexCombinaison = -1;
    combinaisonsTable.forEach((comb, i) => {
        const c = comb.find(c => `${c.valeur} de ${c.couleur}` === altCarteVolee);
        if (c) { carteVolee = c; indexCombinaison = i; }
    });

    let cartesMain = [];
    cartesMainHTML.forEach(imgHTML => {
        const c = mainJoueur.find(c => `${c.valeur} de ${c.couleur}` === imgHTML.alt);
        if (c) cartesMain.push(c);
    });

    let nouvelleCombinaison = [...cartesMain, carteVolee];
    if (!estCombinaisonValide(nouvelleCombinaison)) return alert("Nouvelle combinaison invalide.");
    if (combinaisonsTable[indexCombinaison].length - 1 < 3) return alert("Pas assez de cartes sur la table.");

    combinaisonsTable[indexCombinaison].splice(combinaisonsTable[indexCombinaison].indexOf(carteVolee), 1);
    cartesMain.forEach(c => mainJoueur.splice(mainJoueur.indexOf(c), 1));
    combinaisonsTable.push(nouvelleCombinaison);

    afficherMainJoueur();
    afficherTable();
    mettreAJourUI();
    jouerSon(sonPoser); // Son de validation
});

btnPiocher.addEventListener("click", () => {
    if (!estTourJoueur || aPioche || mancheTerminee) return;
    let nouvelleCarte = piocherDansLeDeck();
    if (!nouvelleCarte) return; 
    mainJoueur.push(nouvelleCarte);
    aPioche = true;
    afficherMainJoueur();
    mettreAJourUI();
    jouerSon(sonPiocher); // Son de pioche
});

btnDefausser.addEventListener("click", () => {
    if (!estTourJoueur || !aPioche || mancheTerminee) return;
    const carteSelectionneeHTML = document.querySelector('#main-joueur .carte.selectionnee');
    if (!carteSelectionneeHTML) return alert("Sélectionnez une carte à jeter.");
    const altCarte = carteSelectionneeHTML.alt;
    const indexCarte = mainJoueur.findIndex(c => `${c.valeur} de ${c.couleur}` === altCarte);
    if (indexCarte !== -1) {
        carteDefausseActuelle = mainJoueur.splice(indexCarte, 1)[0];
        afficherCarteDefausse();
        afficherMainJoueur();
        jouerSon(sonPiocher); // Son de défausse
        if (mainJoueur.length === 0) return finDeManche('joueur');
        finirTourJoueur();
    }
});

// --- CERVEAU DE L'INTELLIGENCE ARTIFICIELLE (IA) ---

function finirTourJoueur() {
    estTourJoueur = false;
    aPioche = false;
    premierTourGlobal = false; 
    mettreAJourUI();
    setTimeout(tourOrdinateur, 1500); 
}

function tourOrdinateur() {
    if (mancheTerminee) return;
    
    let nouvelleCarte = piocherDansLeDeck();
    if (!nouvelleCarte) return;
    mainOrdi.push(nouvelleCarte);
    mettreAJourUI();

    setTimeout(() => {
        iaJoueCombinaisons();

        setTimeout(() => {
            let carteJetee = iaChoisitCarteAJeter();
            mainOrdi.splice(mainOrdi.indexOf(carteJetee), 1);
            carteDefausseActuelle = carteJetee;
            
            afficherCarteDefausse();
            afficherTable();
            mettreAJourUI();

            if (mainOrdi.length === 0) return finDeManche('ordi');

            estTourJoueur = true;
            mettreAJourUI();
        }, 1000);

    }, 1000);
}

function iaTrouveCombinaisons(main) {
    let combinaisons = [];
    for (let val of valeurs) {
        let cartesMemeValeur = main.filter(c => c.valeur === val);
        if (cartesMemeValeur.length >= 3) {
            combinaisons.push(cartesMemeValeur.slice(0, cartesMemeValeur.length)); 
        }
    }
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

function iaJoueCombinaisons() {
    let combinaisonsPossibles = iaTrouveCombinaisons(mainOrdi);
    if (combinaisonsPossibles.length === 0) return;

    if (!aPoseOuvertureOrdi) {
        combinaisonsPossibles.sort((a, b) => {
            let ptsA = a.reduce((s, c) => s + calculerPointsCarte(c), 0);
            let ptsB = b.reduce((s, c) => s + calculerPointsCarte(c), 0);
            return ptsB - ptsA;
        });

        let combinaisonsA_Poser = [];
        let pointsTotal = 0;

        for (let comb of combinaisonsPossibles) {
            let ptsComb = comb.reduce((s, c) => s + calculerPointsCarte(c), 0);
            combinaisonsA_Poser.push(comb);
            pointsTotal += ptsComb;
            if (pointsTotal >= 51) break; 
        }

        if (pointsTotal >= 51) {
            combinaisonsA_Poser.forEach(comb => {
                comb.forEach(c => mainOrdi.splice(mainOrdi.indexOf(c), 1));
                combinaisonsTable.push(comb);
            });
            aPoseOuvertureOrdi = true;
            afficherTable();
        }
    } else {
        combinaisonsPossibles.forEach(comb => {
            comb.forEach(c => mainOrdi.splice(mainOrdi.indexOf(c), 1));
            combinaisonsTable.push(comb);
        });
        afficherTable();
    }
}

function iaChoisitCarteAJeter() {
    let combinaisonsPossibles = iaTrouveCombinaisons(mainOrdi);
    let cartesUtiles = [];
    combinaisonsPossibles.forEach(comb => {
        comb.forEach(c => cartesUtiles.push(c));
    });

    let cartesInutiles = mainOrdi.filter(c => !cartesUtiles.includes(c));

    if (cartesInutiles.length > 0) {
        if (niveauDifficulte === 'facile') {
            return cartesInutiles[0];
        } else if (niveauDifficulte === 'moyen') {
            cartesInutiles.sort((a, b) => calculerPointsCarte(a) - calculerPointsCarte(b));
            return cartesInutiles[0];
        } else {
            cartesInutiles.sort((a, b) => calculerPointsCarte(b) - calculerPointsCarte(a));
            return cartesInutiles[0];
        }
    }

    mainOrdi.sort((a, b) => calculerPointsCarte(a) - calculerPointsCarte(b));
    return mainOrdi[0];
}

// --- FIN DE MANCHE ---
function finDeManche(gagnant) {
    mancheTerminee = true;
    mettreAJourUI();

    let pointsJoueurManche = calculerPointsMain(mainJoueur);
    let pointsOrdiManche = calculerPointsMain(mainOrdi);
    
    if (gagnant === 'bloque') {
        alert("Pioche vide, on compte les points !");
    } else {
        if (gagnant === 'joueur' && !aPoseOuvertureOrdi) pointsOrdiManche = 100;
        if (gagnant === 'ordi' && !aPoseOuvertureJoueur) pointsJoueurManche = 100;
        if (gagnant === 'joueur') pointsJoueurManche = 0;
        if (gagnant === 'ordi') pointsOrdiManche = 0;
    }

    scoreJoueur += pointsJoueurManche;
    scoreOrdi += pointsOrdiManche;
    mettreAJourScores();

    // JOUER LE SON DE VICTOIRE OU DÉFAITE
    if (gagnant === 'joueur') jouerSon(sonVictoire);
    else if (gagnant === 'ordi') jouerSon(sonDefaite);

    let titre = gagnant === 'joueur' ? "Manche Gagnée ! 🎉" : (gagnant === 'ordi' ? "L'ordinateur gagne... 😢" : "Manche bloquée ! 🤝");
    let texteDetail = `Vous avez marqué : ${pointsJoueurManche} pts<br>L'ordinateur a marqué : ${pointsOrdiManche} pts`;
    
    let texteFin = "";
    if (scoreJoueur >= 100 || scoreOrdi >= 100) {
        if (scoreJoueur >= 100 && scoreOrdi >= 100) texteFin = "Match nul !";
        else if (scoreJoueur >= 100) texteFin = "Vous avez atteint 100 points. L'ordinateur remporte la partie !";
        else texteFin = "L'ordinateur a atteint 100 points. Vous remportez la partie ! 🏆";
        
        titre = "Fin de la Partie !";
        document.getElementById("btn-suivant").textContent = "Rejouer une partie";
        document.getElementById("btn-suivant").onclick = () => location.reload();
    } else {
        document.getElementById("btn-suivant").textContent = "Manche Suivante";
        document.getElementById("btn-suivant").onclick = () => demarrerManche();
    }

    document.getElementById("titre-victoire").textContent = titre;
    document.getElementById("texte-victoire").innerHTML = texteFin;
    document.getElementById("detail-points").innerHTML = texteDetail;
    document.getElementById("ecran-victoire").style.display = "flex";
}
