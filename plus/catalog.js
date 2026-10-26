// Presentation and the explicit checkout route stay together. A future app must
// supply its own approved product/route; never silently sell it the Hanzi pass.
export const apps = Object.freeze({
  bloom: {
    name: 'Hanzi Bloom', shortName: 'Bloom', icon: '/plus/assets/bloom-icon-128.webp',
    checkout: '/en/apps/hanzi-bloom/plus/checkout/?app=bloom',
    title: ['Your Chinese.', 'In full ', 'bloom.'],
    eyebrow: 'A word today. A world tomorrow.',
    description: 'Turn new words into little everyday adventures. Stories, listening and practice that stay with you.',
    fact: 'Published HSK 1–3 lessons',
    panda: '/plus/assets/bloom-panda-778.webp', pandaAlt: 'Bao, the red panda, watering a little seedling',
    pandaSrcset: '/plus/assets/bloom-panda-320.webp 320w, /plus/assets/bloom-panda-560.webp 560w, /plus/assets/bloom-panda-778.webp 778w',
    pandaSizes: '(max-width:520px) 80vw, (max-width:800px) 360px, (max-width:1100px) 36vw, 440px',
    annotation: 'a little word garden', note: 'a little progress, every day',
    demoAction: 'Grow another word', demoAria: 'Discover another Chinese word',
    footer: 'Curiosity looks good on you.',
    featureTitle: 'More room to explore.',
    features: [
      ['Words with a world around them.', 'Discover the published HSK 1–3 lessons through stories, dialogues and bite-size practice.'],
      ['Make it click.', 'Listen, play with familiar words and find the meaning in everyday conversations.'],
      ['Keep your own rhythm.', 'Practice without lesson-unlock ads. Come back for a little more whenever you like.']
    ],
    miniWord: '你好', miniLabel: 'hello, new world', soundLabel: 'listen · notice · remember',
    progressLabel: 'one little step at a time',
    contentNote: 'HSK 4–6 lessons are still growing. They are not included as published lessons.',
    cards: [
      {word:'你好', reading:'nǐ hǎo', meaning:'hello', label:'A little hello'},
      {word:'朋友', reading:'péngyou', meaning:'friend', label:'A familiar face'},
      {word:'谢谢', reading:'xièxie', meaning:'thank you', label:'A little kindness'}
    ]
  },
  keys: {
    name: 'Hanzi Keys', shortName: 'Keys', icon: '/plus/assets/keys-icon-128.webp',
    checkout: '/en/apps/hanzi-bloom/plus/checkout/?app=keys',
    title: ['Small pieces.', 'Big ', 'discoveries.'],
    eyebrow: 'There is a little clue in every character.',
    description: 'Go beyond memorizing shapes. Discover the parts, build characters and make them your own.',
    fact: 'Break down · build · write',
    panda: '/plus/assets/keys-panda-960.webp', pandaAlt: 'Bao, the red panda, opening an illustrated atlas with a glowing golden key',
    pandaSrcset: '/plus/assets/keys-panda-384.webp 384w, /plus/assets/keys-panda-640.webp 640w, /plus/assets/keys-panda-960.webp 960w',
    pandaSizes: '(max-width:520px) 100vw, (max-width:800px) 470px, (max-width:1100px) 46vw, 570px',
    annotation: 'a little character workshop', note: 'oh, now it makes sense',
    demoAction: 'Bring the pieces together', demoAria: 'See how sun and moon appear in the character for bright',
    footer: 'The best part? The little “aha”.',
    featureTitle: 'See the shape. Find the clue.',
    features: [
      ['A character, a little closer.', 'Explore the visible parts and familiar shapes inside Chinese characters.'],
      ['Build your understanding.', 'Bring pieces together, notice the differences and practice what you discover.'],
      ['Make your mark.', 'Write, review and explore at your own pace, with Plus access and no ads.']
    ],
    miniWord: '日 + 月', miniLabel: 'two familiar shapes', soundLabel: 'notice · build · remember',
    progressLabel: 'from a shape to a familiar friend',
    contentNote: 'Parts help you recognize characters. They do not always explain a character’s meaning or origin.',
    cards: [
      {word:'日 + 月', reading:'rì · yuè', meaning:'sun · moon', label:'Two familiar shapes'},
      {word:'明', reading:'míng', meaning:'bright', label:'One little discovery'}
    ]
  }
});
