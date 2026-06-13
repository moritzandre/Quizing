/* ====================================================================
   NERD QUIZ (read-only built-in) — League of Legends & other nerdy lore.
   --------------------------------------------------------------------
   Showcases the newer round types: morph (all three effects), picture,
   and the real map. Champion art is hotlinked from Riot's public Data
   Dragon CDN (no key, stable URLs).
   ==================================================================== */

const SPLASH = (name) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`;

/** Built-in nerdy sample quiz. */
export const NERD_QUIZ = {
  id: "nerd",
  sample: true,
  title: "Nexus Nights — Nerd Quiz",
  rounds: [
    {
      id: "n1",
      type: "classic",
      title: "Summoner's Warm-Up",
      timer: 25,
      questions: [
        {
          id: "n1a",
          q: "How many players are on each team in a standard League of Legends match?",
          a: "Five",
          points: 10,
        },
        {
          id: "n1b",
          q: "What is the giant purple-pit monster that grants a team-wide buff called?",
          a: "Baron Nashor",
          points: 10,
        },
        {
          id: "n1c",
          q: "In Minecraft, what is the minimum tool tier needed to mine diamond ore?",
          a: "An iron pickaxe",
          points: 10,
        },
        { id: "n1d", q: "In gamer shorthand, what does “GG” stand for?", a: "Good Game", points: 10 },
      ],
    },
    {
      id: "n2",
      type: "jeopardy",
      title: "The Nerd Board",
      timer: null,
      categories: [
        {
          id: "nc1",
          name: "Gaming",
          questions: [
            { id: "ng1", clue: "This mustachioed Italian plumber is Nintendo's mascot.", answer: "Mario", points: 100 },
            {
              id: "ng2",
              clue: "Blocky sandbox game by Mojang where you mine and build.",
              answer: "Minecraft",
              points: 200,
            },
            {
              id: "ng3",
              clue: "Riot's auto-battler spin-off set on the Convergence.",
              answer: "Teamfight Tactics (TFT)",
              points: 300,
            },
          ],
        },
        {
          id: "nc2",
          name: "Sci-Fi",
          questions: [
            { id: "ns1", clue: "“May the Force be with you” is from this saga.", answer: "Star Wars", points: 100 },
            { id: "ns2", clue: "The desert planet and spice source in Dune.", answer: "Arrakis", points: 200 },
            {
              id: "ns3",
              clue: "The sentient computer HAL 9000 features in this 1968 Kubrick film.",
              answer: "2001: A Space Odyssey",
              points: 300,
            },
          ],
        },
        {
          id: "nc3",
          name: "Anime",
          questions: [
            { id: "na1", clue: "Orange-clad ninja whose dream is to become Hokage.", answer: "Naruto", points: 100 },
            {
              id: "na2",
              clue: "Humanity hides behind giant walls from man-eating Titans in this series.",
              answer: "Attack on Titan",
              points: 200,
            },
            {
              id: "na3",
              clue: "A shinigami's notebook that kills anyone whose name is written in it.",
              answer: "Death Note",
              points: 300,
            },
          ],
        },
      ],
    },
    {
      id: "n3",
      type: "hints",
      title: "Which Champion Am I?",
      timer: null,
      questions: [
        {
          id: "nh1",
          answer: "Teemo",
          hints: [
            "I'm a yordle from Bandle City.",
            "Stand still long enough and I vanish from sight.",
            "I leave poisonous mushrooms scattered across the map.",
            "I'm known as the Swift Scout.",
            "Players love to hate this tiny, cheerful menace.",
          ],
        },
        {
          id: "nh2",
          answer: "Jinx",
          hints: [
            "I hail from the undercity of Zaun.",
            "Chaos and explosions are my whole personality.",
            "My weapons are named Fishbones and Pow-Pow.",
            "An enforcer named Vi is my estranged sister.",
            "The show Arcane made me a household name.",
          ],
        },
        {
          id: "nh3",
          answer: "Lux",
          // Mixed hints: text clues then a picture give-away (media hints).
          hints: [
            "I'm a noble from Demacia who hides a secret.",
            "I command light itself.",
            "My ultimate fires a giant beam across the lane.",
            { type: "image", url: SPLASH("Lux") },
          ],
        },
      ],
    },
    {
      id: "n4",
      type: "morph",
      title: "Guess the Champion Splash",
      timer: null,
      questions: [
        { id: "nm1", url: SPLASH("Ahri"), a: "Ahri", points: 50, effect: "blur", steps: 5 },
        { id: "nm2", url: SPLASH("Garen"), a: "Garen", points: 50, effect: "pixelate", steps: 5 },
        { id: "nm3", url: SPLASH("Thresh"), a: "Thresh", points: 50, effect: "tiles", steps: 6 },
      ],
    },
    {
      id: "n5",
      type: "image",
      title: "Name That Champion",
      timer: 15,
      questions: [
        { id: "ni1", url: SPLASH("Lux"), q: "Which champion is this?", a: "Lux", points: 10 },
        { id: "ni2", url: SPLASH("Yasuo"), q: "Which champion is this?", a: "Yasuo", points: 10 },
        { id: "ni3", url: SPLASH("Ezreal"), q: "Which champion is this?", a: "Ezreal", points: 10 },
      ],
    },
    {
      id: "n7",
      type: "fusion",
      title: "Who Did We Blend?",
      timer: null,
      questions: [
        { id: "nf1", urlA: SPLASH("Yasuo"), urlB: SPLASH("Yone"), a: "Yasuo + Yone", points: 40, steps: 4 },
        {
          id: "nf2",
          urlA: SPLASH("Garen"),
          urlB: SPLASH("Lux"),
          a: "Garen + Lux (the Crownguards)",
          points: 40,
          steps: 4,
        },
      ],
    },
    {
      id: "n6",
      type: "map",
      title: "Nerd HQ Geography",
      timer: null,
      questions: [
        {
          id: "nx1",
          q: "Where is Riot Games headquartered?",
          name: "Riot Games — Los Angeles, USA",
          lat: 34.02,
          lng: -118.47,
          points: 10,
        },
        {
          id: "nx2",
          q: "Where is Nintendo's main headquarters?",
          name: "Nintendo — Kyoto, Japan",
          lat: 34.97,
          lng: 135.76,
          points: 10,
        },
        {
          id: "nx3",
          q: "Where is CD Projekt Red (The Witcher, Cyberpunk 2077) based?",
          name: "CD Projekt Red — Warsaw, Poland",
          lat: 52.23,
          lng: 21.01,
          points: 10,
        },
        {
          id: "nx4",
          q: "Where was Hobbiton (The Lord of the Rings) filmed?",
          name: "Hobbiton — Matamata, New Zealand",
          lat: -37.87,
          lng: 175.68,
          points: 10,
        },
      ],
    },
  ],
};
