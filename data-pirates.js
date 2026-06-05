// ===========================================================================
//  data-pirates.js  —  startroster voor het crew-manager spel
// ---------------------------------------------------------------------------
//  Veld-uitleg per personage:
//    n  = naam
//    r   = primaire role / natural role.
//    alt = (optioneel) extra rollen, bv. alt:["Doctor"]. Marco is bv.
//          zowel Swordsman als Doctor.
//          REGEL: het VAK waarin je iemand zet bepaalt z'n duel-tier
//            Captain-vak    -> tier Captain
//            Swordsman-vak -> tier Swordsman
//            de andere 8    -> tier "Rest" (onderling gematcht)
//          De rol(len) bepalen alleen of hij de natural-role BONUS krijgt
//          in dat vak. Staat hij in een vak dat in r of alt zit -> bonus.
//         Geldige rollen: Captain, Swordsman, Navigator, Sniper, Chef,
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
//  Totaal: 110 = 10 captains + 76 crewleden + 15 free agents + 9 navy.
//  Base stats geven identiteit; de bounty-groei (training/gevechten/markt)
//  komt daar bovenop.
// ===========================================================================

const PIRATES = [

  // --- Straw Hat Pirates ---------------------------------------------------
  { n:"Luffy",   r:"Captain",       p:8, d:8, s:8, c:"Straw Hat Pirates", sp:["Gum Gum Pistol","Gum Gum Bazooka","Red Hawk"] },
  { n:"Zoro",    r:"Swordsman",    p:8, d:7, s:7, c:"Straw Hat Pirates", sp:["Santoryu Ogi","King of Hell"] },
  { n:"Nami",    r:"Navigator",     p:4, d:4, s:7, c:"Straw Hat Pirates", sp:["Thunderbolt Tempo"] },
  { n:"Usopp",   r:"Sniper",        p:4, d:3, s:6, c:"Straw Hat Pirates", sp:["Tabasco Star","Fire Bird Star"] },
  { n:"Sanji",   r:"Chef",          p:7, d:6, s:8, c:"Straw Hat Pirates", sp:["Diable Jambe","Concassé","Hell Memories"] },
  { n:"Chopper", r:"Doctor",        p:4, d:4, s:6, c:"Straw Hat Pirates", sp:["Kung-Fu Point","Monster Point"] },
  { n:"Robin",   r:"Archaeologist", p:6, d:5, s:6, c:"Straw Hat Pirates", sp:["Mil Fleurs","Clutch"] },
  { n:"Franky",  r:"Shipwright",    p:6, d:7, s:5, c:"Straw Hat Pirates", sp:["Radical Beam","Strong Right"] },
  { n:"Brook",   r:"Musician",      p:6, d:5, s:8, c:"Straw Hat Pirates", sp:["Soul Solid", "Chills of the Underworld"] },
  { n:"Jinbe",   r:"Helmsman",      p:8, d:8, s:6, c:"Straw Hat Pirates", sp:["Fish-Man Karate","Arabesque Brick Fist","Shark Shoulder Throw"] },

  // --- Whitebeard Pirates --------------------------------------------------
  { n:"Whitebeard", r:"Captain",    p:8, d:8, s:8, c:"Whitebeard Pirates", sp:["Gura Gura no Mi","Quake Punch"] },
  { n:"Marco",      r:"Doctor",     p:7, d:8, s:8, c:"Whitebeard Pirates", sp:["Phoenix Brand"] },
  { n:"Jozu",       r:"Crewmate",   p:8, d:8, s:5, c:"Whitebeard Pirates", sp:["Diamond Crusher"] },
  { n:"Vista",      r:"Crewmate",   p:7, d:6, s:7, c:"Whitebeard Pirates", sp:["Rose Rondo"] },
  { n:"Thatch",     r:"Doctor",   p:7, d:6, s:7, c:"Whitebeard Pirates", sp:[""] },
  { n:"Izo",        r:"Sniper",   p:6, d:5, s:7, c:"Whitebeard Pirates", sp:["Twin Pistols"] },
  { n:"Ace",        r:"Crewmate",   p:8, d:6, s:8, c:"Whitebeard Pirates", sp:["Fire Fist","Flame Commandment"] },

  // --- Big Mom Pirates -----------------------------------------------------
  { n:"Big Mom",   r:"Captain",     p:8, d:8, s:8, c:"Big Mom Pirates", sp:["Soul Pocus","Maser Cannon"] },
  { n:"Katakuri",  r:"Swordsman",  p:8, d:8, s:8, c:"Big Mom Pirates", sp:["Mochi Tsuki","Buzzcut Mochi"] },
  { n:"Streusen",  r:"Chef",        p:5, d:6, s:4, c:"Big Mom Pirates", sp:[] },
  { n:"Smoothie",  r:"Crewmate",    p:7, d:6, s:6, c:"Big Mom Pirates", sp:["Juice Squeeze"] },
  { n:"Cracker",   r:"Crewmate",    p:7, d:8, s:6, c:"Big Mom Pirates", sp:["Pretzel","Biscuit Soldier"] },
  { n:"Perospero", r:"Crewmate",    p:6, d:6, s:6, c:"Big Mom Pirates", sp:["Candy Wall"] },
  { n:"Daifuku",   r:"Crewmate",    p:6, d:6, s:5, c:"Big Mom Pirates", sp:["Genie Smash"] },
  { n:"Oven",      r:"Crewmate",    p:7, d:6, s:5, c:"Big Mom Pirates", sp:["Heat Palm"] },
  { n:"Mont-d'Or", r:"Crewmate",    p:5, d:5, s:5, c:"Big Mom Pirates", sp:["Book Prison"] },
  { n:"Brulee",    r:"Crewmate",    p:4, d:4, s:5, c:"Big Mom Pirates", sp:["Mirro-World"] },
  { n:"Pudding",   r:"Crewmate",    p:4, d:3, s:5, c:"Big Mom Pirates", sp:["Memory Wipe"] },
  { n:"Galette",   r:"Crewmate",    p:6, d:5, s:6, c:"Big Mom Pirates", sp:["Butter Shot"] },
  { n:"Amande",    r:"Crewmate",    p:6, d:5, s:6, c:"Big Mom Pirates", sp:["Shirauo Slash"] },

  // --- Beasts Pirates ------------------------------------------------------
  { n:"Kaido",       r:"Captain",    p:8, d:8, s:8, c:"Beasts Pirates", sp:["Thunder Bagua","Boro Breath"] },
  { n:"King",        r:"Swordsman", p:8, d:8, s:8, c:"Beasts Pirates", sp:["Flame Dragon King"] },
  { n:"Queen",       r:"Doctor",     p:8, d:8, s:7, c:"Beasts Pirates", sp:["Plague Rounds"] },
  { n:"Jack",        r:"Crewmate",   p:8, d:8, s:5, c:"Beasts Pirates", sp:["Mammoth Stomp"] },
  { n:"Who's-Who",   r:"Crewmate",   p:7, d:6, s:7, c:"Beasts Pirates", sp:["Sword-Cat Strike"] },
  { n:"Black Maria", r:"Crewmate",   p:6, d:6, s:6, c:"Beasts Pirates", sp:["Wanyudo"] },
  { n:"Sasaki",      r:"Crewmate",   p:7, d:6, s:6, c:"Beasts Pirates", sp:["Armadillo Roll"] },
  { n:"Ulti",        r:"Crewmate",   p:7, d:6, s:6, c:"Beasts Pirates", sp:["Headbutt Ram"] },
  { n:"Page One",    r:"Crewmate",   p:6, d:6, s:5, c:"Beasts Pirates", sp:["Spino Bite"] },
  { n:"Babanuki",    r:"Crewmate",   p:5, d:6, s:4, c:"Beasts Pirates", sp:["Tank Blast"] },
  { n:"Sheepshead",  r:"Crewmate",   p:5, d:5, s:5, c:"Beasts Pirates", sp:["Horn Slash"] },
  { n:"Speed",       r:"Crewmate",   p:5, d:4, s:7, c:"Beasts Pirates", sp:["Hoof Stomp"] },

  // --- Blackbeard Pirates --------------------------------------------------
  { n:"Blackbeard",     r:"Captain",    p:8, d:8, s:8, c:"Blackbeard Pirates", sp:["Black Hole","Liberation"] },
  { n:"Shiryu",         r:"Swordsman", p:8, d:7, s:8, c:"Blackbeard Pirates", sp:["Invisible Slash"] },
  { n:"Van Augur",      r:"Sniper",     p:7, d:5, s:8, c:"Blackbeard Pirates", sp:["Eagle Shot"] },
  { n:"Doc Q",          r:"Doctor",     p:4, d:6, s:4, c:"Blackbeard Pirates", sp:[] },
  { n:"Laffitte",       r:"Navigator",  p:6, d:5, s:7, c:"Blackbeard Pirates", sp:[] },
  { n:"Jesus Burgess",  r:"Crewmate",   p:9, d:6, s:6, c:"Blackbeard Pirates", sp:["Champion Press"] },
  { n:"Vasco Shot",     r:"Crewmate",   p:6, d:6, s:5, c:"Blackbeard Pirates", sp:[] },
  { n:"Sanjuan Wolf",   r:"Crewmate",   p:8, d:9, s:3, c:"Blackbeard Pirates", sp:[] },
  { n:"Catarina Devon", r:"Crewmate",   p:7, d:6, s:6, c:"Blackbeard Pirates", sp:["Nine-Tail Bite"] },
  { n:"Avalo Pizarro",  r:"Crewmate",   p:6, d:6, s:5, c:"Blackbeard Pirates", sp:["Island Crush"] },

  // --- Donquixote Pirates --------------------------------------------------
  { n:"Doflamingo", r:"Captain",    p:8, d:8, s:8, c:"Donquixote Pirates", sp:["Overheat","Birdcage"] },
  { n:"Vergo",      r:"Swordsman", p:8, d:7, s:7, c:"Donquixote Pirates", sp:[] },
  { n:"Diamante",   r:"Crewmate",   p:7, d:7, s:6, c:"Donquixote Pirates", sp:["Tackle Flag"] },
  { n:"Pica",       r:"Crewmate",   p:7, d:8, s:4, c:"Donquixote Pirates", sp:["Stone Fist"] },
  { n:"Trebol",     r:"Crewmate",   p:6, d:7, s:4, c:"Donquixote Pirates", sp:["Sticky Bind"] },
  { n:"Sugar",      r:"Crewmate",   p:3, d:3, s:4, c:"Donquixote Pirates", sp:[] },
  { n:"Monet",      r:"Crewmate",   p:5, d:5, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Senor Pink", r:"Crewmate",   p:6, d:6, s:5, c:"Donquixote Pirates", sp:["Hard Tackle","Super Suplex"] },
  { n:"Gladius",    r:"Crewmate",   p:6, d:5, s:6, c:"Donquixote Pirates", sp:["Burst Spike"] },
  { n:"Machvise",   r:"Crewmate",   p:6, d:7, s:3, c:"Donquixote Pirates", sp:[] },
  { n:"Lao G",      r:"Crewmate",   p:6, d:5, s:5, c:"Donquixote Pirates", sp:[] },
  { n:"Baby 5",     r:"Crewmate",   p:5, d:5, s:6, c:"Donquixote Pirates", sp:[] },
  { n:"Dellinger",  r:"Crewmate",   p:6, d:5, s:7, c:"Donquixote Pirates", sp:["Fighting Fish Kick"] },

  // --- Red Hair Pirates ----------------------------------------------------
  { n:"Shanks",         r:"Captain",    p:8, d:8, s:8, c:"Red Hair Pirates", sp:["Divine Departure","Haki Slash"] },
  { n:"Benn Beckman",   r:"Swordsman", p:8, d:8, s:8, c:"Red Hair Pirates", sp:["Rifle Crack"] },
  { n:"Yasopp",         r:"Sniper",     p:7, d:7, s:8, c:"Red Hair Pirates", sp:["Hawk-Eye Shot"] },
  { n:"Hongo",          r:"Doctor",     p:5, d:5, s:5, c:"Red Hair Pirates", sp:[] },
  { n:"Lucky Roux",     r:"Chef",   p:7, d:8, s:6, c:"Red Hair Pirates", sp:["Point-Blank Shot"] },
  { n:"Rockstar",       r:"Crewmate",   p:5, d:5, s:6, c:"Red Hair Pirates", sp:[] },
  { n:"Bonk Punch",     r:"Musician",   p:6, d:6, s:6, c:"Red Hair Pirates", sp:[] },
  { n:"Limejuice",      r:"Crewmate",   p:6, d:6, s:6, c:"Red Hair Pirates", sp:[] },

  // --- Heart Pirates -------------------------------------------------------
  { n:"Trafalgar Law", r:"Captain",    p:8, d:8, s:8, c:"Heart Pirates", sp:["Room: Shambles","Gamma Knife"] },
  { n:"Jean Bart",     r:"Helmsman", p:7, d:7, s:5, c:"Heart Pirates", sp:["Heavy Swing"] },
  { n:"Bepo",          r:"Navigator",  p:7, d:6, s:7, c:"Heart Pirates", sp:["Mink Kung-Fu"] },
  { n:"Shachi",        r:"Crewmate",   p:5, d:5, s:6, c:"Heart Pirates", sp:[] },
  { n:"Penguin",       r:"Crewmate",   p:5, d:5, s:6, c:"Heart Pirates", sp:[] },

  // --- Kid Pirates ---------------------------------------------------------
  { n:"Eustass Kid", r:"Captain",    p:8, d:8, s:8, c:"Kid Pirates", sp:["Punk Gibson","Repel","Punk Gibson"] },
  { n:"Killer",      r:"Swordsman",  p:8, d:7, s:8, c:"Kid Pirates", sp:["Scyther Sonic"] },
  { n:"Heat",        r:"Crewmate",   p:6, d:6, s:6, c:"Kid Pirates", sp:["Flame Breath"] },
  { n:"Wire",        r:"Crewmate",   p:6, d:6, s:6, c:"Kid Pirates", sp:[] },

  // --- Buggy Pirates -------------------------------------------------------
  { n:"Buggy",   r:"Captain",    p:8, d:8, s:8, c:"Buggy Pirates", sp:["Chop-Chop Cannon","Muggy Ball"] },
  { n:"Cabaji",  r:"Swordsman", p:5, d:4, s:6, c:"Buggy Pirates", sp:[] },
  { n:"Mohji",   r:"Crewmate",   p:4, d:4, s:5, c:"Buggy Pirates", sp:[] },
  { n:"Alvida",  r:"Crewmate",   p:5, d:5, s:6, c:"Buggy Pirates", sp:["Slip-Slip Strike"] },
  { n:"Galdino", r:"Crewmate",   p:7, d:5, s:6, c:"Buggy Pirates", sp:["Candle Wall"] },

  // --- Free Agents (vrij op de transfermarkt) ------------------------------
  //  cap:true = ook kiesbaar als captain; zo niet -> blijft op de markt.
  { n:"Dracule Mihawk",    r:"Swordsman", alt:["Crewmate"], p:9, d:7, s:8, c:"Free Agent", sp:["Black Blade Slash","Kokuto Yoru"] },
  { n:"Crocodile",         r:"Swordsman", alt:["Crewmate"], cap:true, p:8, d:8, s:8, c:"Free Agent", sp:["Desert Samble","Ground Death"] },
  { n:"Boa Hancock",       r:"Crewmate",   cap:true, p:8, d:7, s:8, c:"Free Agent", sp:["Love-Love Beam","Perfume Femur"] },
  { n:"Sabo",              r:"Crewmate",   p:8, d:7, s:8, c:"Free Agent", sp:["Dragon Claw Fist","Fire Fist"] },
  { n:"Rob Lucci",         r:"Crewmate",   p:8, d:7, s:8, c:"Free Agent", sp:["Ten Finger Pistol","Tempest Kick"] },
  { n:"Cavendish",         r:"Crewmate",   p:7, d:6, s:8, c:"Free Agent", sp:["Swan Lake"] },
  { n:"Bartolomeo",        r:"Crewmate",   p:6, d:7, s:5, c:"Free Agent", sp:["Barrier Crash"] },
  { n:"Bartholomew Kuma",  r:"Crewmate",   p:8, d:8, s:6, c:"Free Agent", sp:["Ursa Shock","Pad Cannon"] },
  { n:"Gecko Moria",       r:"Crewmate",   p:7, d:7, s:5, c:"Free Agent", sp:["Shadow Asgard"] },
  { n:"Loki",              r:"Swordsman", alt:["Crewmate"], cap:true, p:8, d:8, s:8, c:"Free Agent", sp:["Sun God Strike"] },
  { n:"Mr 1. Daz Bones",   r:"Swordsman", alt:["Crewmate"], p:7, d:6, s:7, c:"Free Agent", sp:["Spartan Slash"] },
  { n:"Kozuki Oden",       r:"Swordsman", alt:["Crewmate"], cap:true, p:7, d:6, s:7, c:"Free Agent", sp:["Togen Totsuka","Paradise Totsuka"] },
  { n:"Kozuki Momonosuke", r:"Crewmate",   p:6, d:6, s:6, c:"Free Agent", sp:["Thunder Bagua"] },
  { n:"Yamato",            r:"Swordsman", alt:["Crewmate"], p:8, d:7, s:8, c:"Free Agent", sp:["Thunder Bagua"] },
  { n:"Kaku",              r:"Crewmate",   p:6, d:6, s:7, c:"Free Agent", sp:["Rankyaku Lanceo","Tempest kick"] },
  // --- Navy / Marines (PvE-bazen op marinebasis-dagen) ----------------------
  //  navy:true = vijand-only; nooit koopbaar en niet in de kapiteinslijst.
  { n:"Akainu",   r:"Admiral", navy:true, p:10, d:9,  s:8,  c:"Marine", sp:["Great Eruption","Hound Blaze"] },
  { n:"Kizaru",   r:"Admiral", navy:true, p:9,  d:8,  s:10, c:"Marine", sp:["Yata Mirror","Amaterasu"] },
  { n:"Fujitora", r:"Admiral", navy:true, p:9,  d:9,  s:8,  c:"Marine", sp:["Gravity Blade","Meteor"] },
  { n:"Ryokugyu", r:"Admiral", navy:true, p:9,  d:8,  s:9,  c:"Marine", sp:["Forest Drain","Wood Bind"] },
  { n:"Kuzan",    r:"Admiral", navy:true, p:9,  d:9,  s:8,  c:"Marine", sp:["Ice Age","Ice Saber"] },
  { n:"Sengoku",  r:"Admiral", navy:true, p:9,  d:9,  s:8,  c:"Marine", sp:["Shockwave","Buddha Palm"] },
  { n:"Garp",     r:"Admiral", navy:true, p:10, d:10, s:8,  c:"Marine", sp:["Fist of Love","Galaxy Impact"] },
  { n:"Smoker",   r:"Marine",  navy:true, p:8,  d:7,  s:8,  c:"Marine", sp:["White Blow","White Snake"] },
  { n:"Koby",     r:"Marine",  navy:true, p:7,  d:6,  s:7,  c:"Marine", sp:["Soru Strike","Galaxy Impact"] },
];

// Beschikbaar maken voor de browser (zoals data-onepiece.js)
if (typeof window !== "undefined") { window.PIRATES = PIRATES; }