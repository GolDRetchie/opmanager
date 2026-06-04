// ===========================================================================
//  data-pirates.js  —  startroster voor het crew-manager spel
// ---------------------------------------------------------------------------
//  Veld-uitleg per personage:
//    n  = naam
//    r   = primaire role / natural role.
//    alt = (optioneel) extra rollen, bv. alt:["Doctor"]. Marco is bv.
//          zowel Right-Hand als Doctor.
//          REGEL: het VAK waarin je iemand zet bepaalt z'n duel-tier
//            Captain-vak    -> tier Captain
//            Right-Hand-vak -> tier Right-Hand
//            de andere 8    -> tier "Rest" (onderling gematcht)
//          De rol(len) bepalen alleen of hij de natural-role BONUS krijgt
//          in dat vak. Staat hij in een vak dat in r of alt zit -> bonus.
//         Geldige rollen: Captain, Right-Hand, Navigator, Sniper, Chef,
//         Doctor, Archaeologist, Shipwright, Musician, Helmsman, Crewmate
//
//         "Crewmate" = flexibele alleskunner. Past in elk Rest-vak ZONDER
//         bonus of malus. Een specialist (bv. Navigator) krijgt juist een
//         bonus op z'n eigen vak en een kleine malus op een ander vak.
//
//    cap = (optioneel) true = mag als captain gekozen worden. Wordt deze
//          niet als een van de 8 actieve captains gekozen, dan komt hij/zij
//          gewoon als koopbaar crewlid op de transfermarkt (met eigen stats).
//
//    p  = base Power   (1-10)  -> schade per klap
//    d  = base Defense (1-10)  -> HP + incasseringsvermogen
//    s  = base Speed   (1-10)  -> wie eerst slaat + ontwijkkans
//         (Alle captains hebben gelijke base-stats: geen captain-bias.)
//    c  = start-crew (canonieke naam). De speler mag z'n eigen crew een
//         eigen naam geven; die wordt dan in de simulatie getoond.
//         "Free Agent" = staat vrij op de transfermarkt.
//    sp = special attacks (commentaar-teksten, optioneel) -> JIJ vult in
//
//  Totaal: 103 personages = 10 captains + 77 crewleden + 16 free agents.
//  Base stats geven identiteit; de bounty-groei (training/gevechten/markt)
//  komt daar bovenop.
// ===========================================================================

const PIRATES = [

  // --- Straw Hat Pirates ---------------------------------------------------
  { n:"Luffy",   r:"Captain",       p:8, d:8, s:8, c:"Straw Hat Pirates", sp:[] },
  { n:"Zoro",    r:"Right-Hand",    p:8, d:7, s:9, c:"Straw Hat Pirates", sp:[] },
  { n:"Nami",    r:"Navigator",     p:4, d:4, s:7, c:"Straw Hat Pirates", sp:[] },
  { n:"Usopp",   r:"Sniper",        p:6, d:6, s:6, c:"Straw Hat Pirates", sp:[] },
  { n:"Sanji",   r:"Chef",          p:8, d:7, s:8, c:"Straw Hat Pirates", sp:[] },
  { n:"Chopper", r:"Doctor",        p:6, d:7, s:6, c:"Straw Hat Pirates", sp:[] },
  { n:"Robin",   r:"Archaeologist", p:6, d:6, s:8, c:"Straw Hat Pirates", sp:[] },
  { n:"Franky",  r:"Shipwright",    p:8, d:7, s:5, c:"Straw Hat Pirates", sp:[] },
  { n:"Brook",   r:"Musician",      p:7, d:6, s:8, c:"Straw Hat Pirates", sp:[] },
  { n:"Jinbe",   r:"Helmsman",      p:8, d:8, s:6, c:"Straw Hat Pirates", sp:[] },

  // --- Whitebeard Pirates --------------------------------------------------
  { n:"Whitebeard", r:"Captain",    p:8, d:8, s:8, c:"Whitebeard Pirates", sp:[] },
  { n:"Marco",      r:"Right-Hand", alt:["Doctor"], p:7, d:8, s:8, c:"Whitebeard Pirates", sp:[] },
  { n:"Jozu",       r:"Crewmate",   p:8, d:8, s:5, c:"Whitebeard Pirates", sp:[] },
  { n:"Vista",      r:"Crewmate",   p:7, d:6, s:7, c:"Whitebeard Pirates", sp:[] },
  { n:"Izo",        r:"Crewmate",   p:6, d:5, s:7, c:"Whitebeard Pirates", sp:[] },
  { n:"Ace",        r:"Crewmate",   p:8, d:6, s:8, c:"Whitebeard Pirates", sp:[] },

  // --- Big Mom Pirates -----------------------------------------------------
  { n:"Big Mom",   r:"Captain",     p:8, d:8, s:8, c:"Big Mom Pirates", sp:[] },
  { n:"Katakuri",  r:"Right-Hand",  p:8, d:8, s:8, c:"Big Mom Pirates", sp:[] },
  { n:"Streusen",  r:"Chef",        p:5, d:6, s:4, c:"Big Mom Pirates", sp:[] },
  { n:"Smoothie",  r:"Crewmate",    p:7, d:6, s:6, c:"Big Mom Pirates", sp:[] },
  { n:"Cracker",   r:"Crewmate",    p:7, d:8, s:6, c:"Big Mom Pirates", sp:[] },
  { n:"Perospero", r:"Crewmate",    p:6, d:6, s:6, c:"Big Mom Pirates", sp:[] },
  { n:"Daifuku",   r:"Crewmate",    p:6, d:6, s:5, c:"Big Mom Pirates", sp:[] },
  { n:"Oven",      r:"Crewmate",    p:7, d:6, s:5, c:"Big Mom Pirates", sp:[] },
  { n:"Mont-d'Or", r:"Crewmate",    p:5, d:5, s:5, c:"Big Mom Pirates", sp:[] },
  { n:"Brulee",    r:"Crewmate",    p:4, d:4, s:5, c:"Big Mom Pirates", sp:[] },
  { n:"Pudding",   r:"Crewmate",    p:4, d:3, s:5, c:"Big Mom Pirates", sp:[] },
  { n:"Galette",   r:"Crewmate",    p:6, d:5, s:6, c:"Big Mom Pirates", sp:[] },
  { n:"Amande",    r:"Crewmate",    p:6, d:5, s:6, c:"Big Mom Pirates", sp:[] },

  // --- Beasts Pirates ------------------------------------------------------
  { n:"Kaido",       r:"Captain",    p:8, d:8, s:8, c:"Beasts Pirates", sp:[] },
  { n:"King",        r:"Right-Hand", p:8, d:8, s:8, c:"Beasts Pirates", sp:[] },
  { n:"Queen",       r:"Doctor",     p:8, d:8, s:7, c:"Beasts Pirates", sp:[] },
  { n:"Jack",        r:"Crewmate",   p:8, d:8, s:5, c:"Beasts Pirates", sp:[] },
  { n:"Who's-Who",   r:"Crewmate",   p:7, d:6, s:7, c:"Beasts Pirates", sp:[] },
  { n:"Black Maria", r:"Crewmate",   p:6, d:6, s:6, c:"Beasts Pirates", sp:[] },
  { n:"Sasaki",      r:"Crewmate",   p:7, d:6, s:6, c:"Beasts Pirates", sp:[] },
  { n:"Ulti",        r:"Crewmate",   p:7, d:6, s:6, c:"Beasts Pirates", sp:[] },
  { n:"Page One",    r:"Crewmate",   p:6, d:6, s:5, c:"Beasts Pirates", sp:[] },
  { n:"Babanuki",    r:"Crewmate",   p:5, d:6, s:4, c:"Beasts Pirates", sp:[] },
  { n:"Sheepshead",  r:"Crewmate",   p:5, d:5, s:5, c:"Beasts Pirates", sp:[] },
  { n:"Speed",       r:"Crewmate",   p:5, d:4, s:7, c:"Beasts Pirates", sp:[] },

  // --- Blackbeard Pirates --------------------------------------------------
  { n:"Blackbeard",     r:"Captain",    p:8, d:8, s:8, c:"Blackbeard Pirates", sp:[] },
  { n:"Shiryu",         r:"Right-Hand", p:8, d:7, s:9, c:"Blackbeard Pirates", sp:[] },
  { n:"Van Augur",      r:"Sniper",     p:8, d:5, s:8, c:"Blackbeard Pirates", sp:[] },
  { n:"Doc Q",          r:"Doctor",     p:4, d:6, s:4, c:"Blackbeard Pirates", sp:[] },
  { n:"Laffitte",       r:"Navigator",  p:6, d:5, s:7, c:"Blackbeard Pirates", sp:[] },
  { n:"Jesus Burgess",  r:"Crewmate",   p:9, d:7, s:6, c:"Blackbeard Pirates", sp:[] },
  { n:"Vasco Shot",     r:"Crewmate",   p:8, d:7, s:5, c:"Blackbeard Pirates", sp:[] },
  { n:"Sanjuan Wolf",   r:"Crewmate",   p:8, d:9, s:3, c:"Blackbeard Pirates", sp:[] },
  { n:"Catarina Devon", r:"Crewmate",   p:7, d:6, s:6, c:"Blackbeard Pirates", sp:[] },
  { n:"Avalo Pizarro",  r:"Crewmate",   p:6, d:6, s:5, c:"Blackbeard Pirates", sp:[] },
  { n:"Kuzan",          r:"Crewmate",   p:9, d:8, s:7, c:"Blackbeard Pirates", sp:[] },

  // --- Donquixote Pirates --------------------------------------------------
  { n:"Doflamingo", r:"Captain",    p:8, d:8, s:8, c:"Donquixote Pirates", sp:[] },
  { n:"Vergo",      r:"Right-Hand", p:8, d:7, s:7, c:"Donquixote Pirates", sp:[] },
  { n:"Diamante",   r:"Crewmate",   p:7, d:7, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Rosinante",  r:"Crewmate",   p:6, d:7, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Pica",       r:"Crewmate",   p:7, d:8, s:4, c:"Donquixote Pirates", sp:[] },
  { n:"Trebol",     r:"Crewmate",   p:6, d:7, s:4, c:"Donquixote Pirates", sp:[] },
  { n:"Sugar",      r:"Crewmate",   p:3, d:3, s:4, c:"Donquixote Pirates", sp:[] },
  { n:"Monet",      r:"Crewmate",   p:5, d:5, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Senor Pink", r:"Crewmate",   p:6, d:6, s:5, c:"Donquixote Pirates", sp:[] },
  { n:"Gladius",    r:"Crewmate",   p:6, d:5, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Machvise",   r:"Crewmate",   p:6, d:7, s:3, c:"Donquixote Pirates", sp:[] },
  { n:"Lao G",      r:"Crewmate",   p:6, d:5, s:5, c:"Donquixote Pirates", sp:[] },
  { n:"Baby 5",     r:"Crewmate",   p:5, d:5, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Dellinger",  r:"Crewmate",   p:6, d:5, s:7, c:"Donquixote Pirates", sp:[] },

  // --- Red Hair Pirates ----------------------------------------------------
  { n:"Shanks",         r:"Captain",    p:8, d:8, s:8, c:"Red Hair Pirates", sp:[] },
  { n:"Benn Beckman",   r:"Right-Hand", p:8, d:8, s:8, c:"Red Hair Pirates", sp:[] },
  { n:"Yasopp",         r:"Sniper",     p:7, d:7, s:8, c:"Red Hair Pirates", sp:[] },
  { n:"Hongo",          r:"Doctor",     p:5, d:5, s:5, c:"Red Hair Pirates", sp:[] },
  { n:"Lucky Roux",     r:"Crewmate",   p:7, d:8, s:6, c:"Red Hair Pirates", sp:[] },
  { n:"Rockstar",       r:"Crewmate",   p:5, d:5, s:6, c:"Red Hair Pirates", sp:[] },
  { n:"Bonk Punch",     r:"Crewmate",   p:6, d:6, s:6, c:"Red Hair Pirates", sp:[] },
  { n:"Limejuice",      r:"Crewmate",   p:6, d:6, s:6, c:"Red Hair Pirates", sp:[] },

  // --- Heart Pirates -------------------------------------------------------
  { n:"Trafalgar Law", r:"Captain",    p:8, d:8, s:8, c:"Heart Pirates", sp:[] },
  { n:"Jean Bart",     r:"Right-Hand", p:7, d:7, s:5, c:"Heart Pirates", sp:[] },
  { n:"Bepo",          r:"Navigator",  p:7, d:6, s:7, c:"Heart Pirates", sp:[] },
  { n:"Shachi",        r:"Crewmate",   p:5, d:5, s:6, c:"Heart Pirates", sp:[] },
  { n:"Penguin",       r:"Crewmate",   p:5, d:5, s:6, c:"Heart Pirates", sp:[] },

  // --- Kid Pirates ---------------------------------------------------------
  { n:"Eustass Kid", r:"Captain",    p:8, d:8, s:8, c:"Kid Pirates", sp:[] },
  { n:"Killer",      r:"Right-Hand", p:8, d:7, s:8, c:"Kid Pirates", sp:[] },
  { n:"Heat",        r:"Crewmate",   p:6, d:6, s:6, c:"Kid Pirates", sp:[] },
  { n:"Wire",        r:"Crewmate",   p:6, d:6, s:6, c:"Kid Pirates", sp:[] },

  // --- Buggy Pirates -------------------------------------------------------
  { n:"Buggy",   r:"Captain",    p:8, d:8, s:8, c:"Buggy Pirates", sp:[] },
  { n:"Cabaji",  r:"Right-Hand", p:5, d:4, s:6, c:"Buggy Pirates", sp:[] },
  { n:"Mohji",   r:"Crewmate",   p:4, d:4, s:5, c:"Buggy Pirates", sp:[] },
  { n:"Alvida",  r:"Crewmate",   p:5, d:5, s:6, c:"Buggy Pirates", sp:[] },
  { n:"Galdino", r:"Crewmate",   p:7, d:5, s:6, c:"Buggy Pirates", sp:[] },

  // --- Free Agents (vrij op de transfermarkt) ------------------------------
  //  cap:true = ook kiesbaar als captain; zo niet -> blijft op de markt.
  { n:"Dracule Mihawk",    r:"Right-Hand", alt:["Crewmate"], cap:true, p:9, d:7, s:8, c:"Free Agent", sp:[] },
  { n:"Crocodile",         r:"Right-Hand", alt:["Crewmate"], cap:true, p:8, d:8, s:8, c:"Free Agent", sp:[] },
  { n:"Boa Hancock",       r:"Crewmate",   cap:true, p:8, d:7, s:8, c:"Free Agent", sp:[] },
  { n:"Sabo",              r:"Crewmate",   p:8, d:7, s:8, c:"Free Agent", sp:[] },
  { n:"Smoker",            r:"Crewmate",   p:8, d:7, s:8, c:"Free Agent", sp:[] },
  { n:"Rob Lucci",         r:"Crewmate",   p:8, d:7, s:8, c:"Free Agent", sp:[] },
  { n:"Cavendish",         r:"Crewmate",   p:7, d:6, s:8, c:"Free Agent", sp:[] },
  { n:"Bartolomeo",        r:"Crewmate",   p:6, d:7, s:5, c:"Free Agent", sp:[] },
  { n:"Bartholomew Kuma",  r:"Crewmate",   p:8, d:8, s:6, c:"Free Agent", sp:[] },
  { n:"Gecko Moria",       r:"Crewmate",   p:7, d:7, s:5, c:"Free Agent", sp:[] },
  { n:"Loki",              r:"Right-Hand", alt:["Crewmate"], p:8, d:8, s:8, c:"Free Agent", sp:[] },
  { n:"Mr 1. Daz Bones",   r:"Right-Hand", alt:["Crewmate"], p:7, d:6, s:7, c:"Free Agent", sp:[] },
  { n:"Kozuki Oden",       r:"Right-Hand", alt:["Crewmate"], p:7, d:6, s:7, c:"Free Agent", sp:[] },
  { n:"Kozuki Momonosuke", r:"Crewmate",   p:6, d:6, s:6, c:"Free Agent", sp:[] },
  { n:"Yamato",            r:"Right-Hand", alt:["Crewmate"], p:8, d:7, s:8, c:"Free Agent", sp:[] },
  { n:"Kaku",              r:"Crewmate",   p:6, d:6, s:7, c:"Free Agent", sp:[] },
];

// Beschikbaar maken voor de browser (zoals data-onepiece.js)
if (typeof window !== "undefined") { window.PIRATES = PIRATES; }