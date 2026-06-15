/* ====================================================================
   SAMPLE QUIZ (read-only; "Edit" creates a copy)
   ==================================================================== */

/** The built-in sample quiz shown on the home screen. */
export const SAMPLE = {
  id: "sample",
  sample: true,
  title: "Friday Night Sampler",
  rounds: [
    {
      id: "s1",
      type: "classic",
      title: "Warm-Up",
      timer: 20,
      questions: [
        { id: "s1a", q: "What is the capital of Australia?", a: "Canberra", points: 10 },
        { id: "s1b", q: "Which chemical element has the symbol O?", a: "Oxygen", points: 10 },
        { id: "s1c", q: "How many strings does a standard guitar have?", a: "Six", points: 10 },
        { id: "s1d", q: "Which planet is known as the Red Planet?", a: "Mars", points: 10 },
      ],
    },
    {
      id: "s2",
      type: "jeopardy",
      title: "The Board",
      timer: null,
      categories: [
        {
          id: "c1",
          name: "Movies",
          questions: [
            { id: "j1", clue: "This boy wizard has a lightning-shaped scar.", answer: "Harry Potter", points: 100 },
            { id: "j2", clue: "1997 blockbuster about a ship and an iceberg.", answer: "Titanic", points: 200 },
            { id: "j3", clue: "Director of Jaws, E.T. and Jurassic Park.", answer: "Steven Spielberg", points: 300 },
          ],
        },
        {
          id: "c2",
          name: "Science",
          questions: [
            { id: "j4", clue: "The everyday name for H₂O.", answer: "Water", points: 100 },
            { id: "j5", clue: "The closest star to Earth.", answer: "The Sun", points: 200 },
            { id: "j6", clue: "Subatomic particle with a negative charge.", answer: "The electron", points: 300 },
          ],
        },
        {
          id: "c3",
          name: "Music",
          questions: [
            { id: "j7", clue: "Liverpool band behind “Hey Jude”.", answer: "The Beatles", points: 100 },
            { id: "j8", clue: "Queen's six-minute epic: “Bohemian ___”.", answer: "Rhapsody", points: 200 },
            { id: "j9", clue: "This instrument has 88 keys.", answer: "The piano", points: 300 },
          ],
        },
      ],
    },
    {
      id: "s3",
      type: "hints",
      title: "Who or What Am I?",
      timer: null,
      questions: [
        {
          id: "h1",
          answer: "Leonardo da Vinci",
          hints: [
            "I was born in Italy in 1452.",
            "I was left-handed and wrote in mirror script.",
            "I sketched flying machines centuries before flight.",
            "I painted The Last Supper.",
            "My most famous portrait hangs in the Louvre.",
          ],
        },
        {
          id: "h2",
          answer: "The Eiffel Tower",
          hints: [
            "I was completed in 1889.",
            "I was only meant to stand for 20 years.",
            "I'm built from about 18,000 iron parts.",
            "I was the world's tallest structure for 41 years.",
            "You'll find me in Paris.",
          ],
        },
      ],
    },
    {
      id: "s4",
      type: "video",
      title: "Watch & Listen",
      timer: null,
      questions: [
        {
          id: "v1",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          q: "Name the artist and the song.",
          a: "Rick Astley – Never Gonna Give You Up",
          points: 10,
          audioOnly: false,
        },
        {
          id: "v2",
          url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
          q: "Audio only — which song (and artist) is this?",
          a: "PSY – Gangnam Style",
          points: 10,
          audioOnly: true,
        },
      ],
    },
    {
      id: "s5",
      type: "image",
      title: "Guess the Flag",
      timer: 15,
      questions: [
        {
          id: "p1",
          url: "https://flagcdn.com/w320/jp.png",
          q: "Which country's flag is this?",
          a: "Japan",
          points: 10,
        },
        {
          id: "p2",
          url: "https://flagcdn.com/w320/br.png",
          q: "Which country's flag is this?",
          a: "Brazil",
          points: 10,
        },
        {
          id: "p3",
          url: "https://flagcdn.com/w320/za.png",
          q: "Which country's flag is this?",
          a: "South Africa",
          points: 10,
        },
      ],
    },
    {
      id: "s6",
      type: "map",
      title: "Where in the World?",
      timer: null,
      questions: [
        { id: "m1", q: "Where is Machu Picchu?", name: "Machu Picchu, Peru", lat: -13.16, lng: -72.55, points: 10 },
        { id: "m2", q: "Where is the Great Pyramid of Giza?", name: "Giza, Egypt", lat: 29.98, lng: 31.13, points: 10 },
        {
          id: "m3",
          q: "Where were the 2000 Summer Olympics held?",
          name: "Sydney, Australia",
          lat: -33.87,
          lng: 151.21,
          points: 10,
        },
      ],
    },
  ],
};
