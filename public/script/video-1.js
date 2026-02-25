export const clips = [
  {
    type: 'footagesAroundTitle',
    title: 'CODE\n2\nANIMATION',
    speech: "Code2Animation is finally here. Transforming your scripts into cinematic visuals with pure control.",
    media: [
      { src: '/footage/chatbot.html', word: 'Code' },
      { src: '/footage/chatbot.html', word: 'Animation' },
      { src: '/footage/chatbot.html', word: 'cinematic' }
    ]
  },
  {
    type: 'footagesFullScreen',
    title: 'PURE\nCONTROL',
    speech: "Absolute control over every pixel, every transition, and every word.",
    media: [
      { src: '/footage/chatbot.html', word: 'pure' },
      { src: '/footage/chatbot.html', word: 'control' },
      { src: '/footage/chatbot.html', word: 'pixel' }
    ]
  },
  {
    type: 'footagesAroundTitle',
    title: 'AI\nGENERATED',
    speech: "Powered by AI, designed by you. Just write the code, and we'll handle the rest.",
    media: [
      { src: '/footage/chatbot.html', word: 'code' },
      { src: '/footage/chatbot.html', word: 'rest' }
    ]
  },
  {
    type: 'footagesFullScreen',
    title: 'READY?',
    speech: "The future of video generation is here. Experience Code2Animation now.",
    media: [
      { src: '/footage/chatbot.html', word: 'future' },
      { src: '/footage/chatbot.html', word: 'experience' },
      { src: '/footage/chatbot.html', word: 'now' }
    ]
  }
];

export const project = {
  name: 'video-1',
  clips
};

export const projects = {
  [project.name]: project
};

if (typeof window !== 'undefined') {
  window.projectsFromScript = projects;
}
