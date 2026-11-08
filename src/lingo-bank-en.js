// =========================
// 플듀 언어 진단소 — 🇺🇸 영어 문제은행 (서버 전용! 화면에 이 파일을 절대 올리지 말 것: 정답·해설 포함)
// 한국어 문제를 번역하지 않고 영어 고유 내용으로 작성 (지시서 PART 2). 문제·해설은 영어
// 표준 변종: 미국 영어(region US) 기준 — 영국 영어와 다른 표기·용법은 출제하지 않거나 해설에 밝힘
// 작성 규칙은 한국어 문제은행과 같음 (lingo-bank-ko.js 위 설명 · scripts/validate-lingo-bank.mjs가 검사)
//  - 문장 배열: 대문자로 시작·마침표로 끝나는 조각, 속담, 연결어(First/Then/Finally 등)로 순서가 하나뿐인 것만
//  - 오류 찾기: 틀린 곳이 정확히 하나인 문장만
// 검수: AI가 사전 근거와 대조(status checked, by ai-ref) — 지시서대로 영어는 원어민 검수 전까지 모든 문항에 expert(사람 검수 필요) 표시
// =========================

const CK = "2026-11-08", BY = "ai-ref";
const SRC = {
  mw: { t: "Merriam-Webster Dictionary", u: "https://www.merriam-webster.com/" },
  cam: { t: "Cambridge Dictionary", u: "https://dictionary.cambridge.org/" },
  oxl: { t: "Oxford Learner's Dictionaries", u: "https://www.oxfordlearnersdictionaries.com/" },
  oxwoty: { t: "Oxford Languages — Word of the Year 2023", u: "https://languages.oup.com/word-of-the-year/2023/" },
  self: { t: "PlayDuo original sentence", u: "https://playduo.kr/" },
};
const base = (id, area, kind, d, src, extra = {}) => ({ id, lang: "en", region: "US", area, game: area, kind, d, src: src.map((k) => SRC[k]), checked: CK, by: BY, status: "checked", ver: 1, tags: [], expert: true, ...extra });
const M = (id, area, d, q, opts, exp, src, extra) => ({ ...base(id, area, "mcq", d, src, extra), q, opts, exp });
const OX = (id, area, d, q, ans, exp, src, extra) => ({ ...base(id, area, "ox", d, src, extra), q, ans, exp });
const ORD = (id, d, q, parts, exp, src) => ({ ...base(id, "arrange", "order", d, src), q, parts, exp });
const SPOT = (id, d, tokens, wrong, fix, exp, src) => ({ ...base(id, "errfind", "spot", d, src), q: "Tap the part of the sentence that contains the error.", tokens, wrong, fix, exp });
const TY = (id, d, text) => ({ ...base(id, "typing", "type", d, ["self"], { by: "auto", expert: false }), q: "Type the sentence exactly as shown.", text, exp: "Accuracy (character errors) and speed (keystrokes per minute) are measured together." });
const SLANG = { volatile: true, asOf: "2026-11", tags: ["slang"] };

export const BANK_EN = [
  // ---------- Spelling & usage ----------
  M("ES0001", "spell", 1, "Which sentence is correct?", ["They're going to their car over there.", "Their going to there car over they're.", "There going to they're car over their.", "They're going to there car over their."], "they're = they are; their = belonging to them; there = in that place.", ["mw", "cam"]),
  M("ES0002", "spell", 1, "Choose the correct spelling.", ["necessary", "neccessary", "necesary", "neccesary"], "necessary has one c and a double s: ne-c-e-ss-ary.", ["mw"]),
  M("ES0003", "spell", 1, "Choose the correct spelling.", ["receive", "recieve", "receeve", "recive"], "After c, the usual spelling is ei: receive, ceiling, deceive.", ["mw"]),
  M("ES0004", "spell", 2, "Complete the sentence: 'The new policy will ___ everyone.'", ["affect", "effect", "afect", "efect"], "affect is usually the verb (to influence); effect is usually the noun (a result).", ["mw", "cam"]),
  M("ES0005", "spell", 2, "Choose the correct spelling.", ["definitely", "definately", "definetly", "defenitely"], "definitely comes from finite: de-fin-ite-ly.", ["mw"]),
  M("ES0006", "spell", 2, "Complete the sentence: 'The dog wagged ___ tail.'", ["its", "it's", "its'", "it is"], "its is the possessive; it's always means it is or it has.", ["mw", "cam"]),
  OX("ES0007", "spell", 2, "'Could of' is a correct written form of 'could have'.", false, "'Could of' comes from how 'could've' sounds. The correct written form is 'could have' or 'could've'.", ["cam"]),
  M("ES0008", "spell", 3, "Choose the correct spelling.", ["accommodate", "accomodate", "acommodate", "accommadate"], "accommodate has a double c and a double m.", ["mw"]),
  M("ES0009", "spell", 3, "Choose the correct spelling.", ["occurrence", "occurence", "ocurrence", "occurrance"], "occurrence has a double c, a double r and ends in -ence.", ["mw"]),
  M("ES0010", "spell", 3, "Complete the sentence: '___ jacket is this?'", ["Whose", "Who's", "Whos", "Who'se"], "whose shows possession; who's means who is or who has.", ["mw", "cam"]),
  M("ES0011", "spell", 4, "Choose the correct spelling.", ["millennium", "millenium", "milennium", "millenniun"], "millennium has a double l and a double n (Latin mille + annus).", ["mw"]),
  M("ES0012", "spell", 4, "Choose the correct spelling.", ["questionnaire", "questionaire", "questionnare", "questionnair"], "questionnaire has a double n and ends in -aire, from French.", ["mw"]),
  { ...base("ES0013", "spell", "sort", 3, ["mw"]), q: "Sort the words: correctly spelled or misspelled?", bins: ["Correct", "Misspelled"], items: [["separate", 0], ["seperate", 1], ["calendar", 0], ["calender", 1], ["embarrass", 0], ["embarass", 1]], exp: "separate (a rat in the middle), calendar (-ar), embarrass (double r and double s)." },
  M("ES0014", "spell", 2, "Complete the sentence: 'Don't ___ your keys again!'", ["lose", "loose", "lost", "loss"], "lose (verb) = to misplace; loose (adjective) = not tight; loss is a noun.", ["mw", "cam"]),
  M("ES0015", "spell", 4, "Choose the correct spelling.", ["conscientious", "conscientous", "consciencious", "conscienscious"], "conscientious = conscience + -tious: con-sci-en-tious.", ["mw"]),

  // ---------- Vocabulary ----------
  M("EV0001", "vocab", 1, "What does 'reluctant' mean?", ["unwilling or hesitant", "very excited", "extremely tired", "easily angered"], "reluctant: feeling or showing hesitation or unwillingness.", ["mw"]),
  M("EV0002", "vocab", 1, "What does 'generous' mean?", ["willing to give freely", "very careful with money", "quick to judge others", "hard to please"], "generous: freely giving or sharing.", ["mw"]),
  M("EV0003", "vocab", 2, "What does 'meticulous' mean?", ["showing great attention to detail", "careless and hasty", "loud and talkative", "easily frightened"], "meticulous: marked by extreme care with details.", ["mw"]),
  M("EV0004", "vocab", 2, "What does 'ambiguous' mean?", ["open to more than one interpretation", "completely clear", "very ambitious", "extremely large"], "ambiguous: able to be understood in more than one way.", ["mw"]),
  M("EV0005", "vocab", 2, "Which word is a synonym of 'diligent'?", ["hardworking", "lazy", "clumsy", "forgetful"], "diligent: showing steady, careful effort — hardworking.", ["mw"]),
  M("EV0006", "vocab", 3, "What does 'ubiquitous' mean?", ["found everywhere", "extremely rare", "very old", "hard to understand"], "ubiquitous: existing or being everywhere at the same time.", ["mw"]),
  M("EV0007", "vocab", 3, "Which word is an antonym of 'frugal'?", ["extravagant", "thrifty", "careful", "modest"], "frugal means careful with money; extravagant means spending too much. thrifty is a synonym.", ["mw"]),
  M("EV0008", "vocab", 3, "What does 'ephemeral' mean?", ["lasting a very short time", "lasting forever", "heavenly", "extremely loud"], "ephemeral: lasting a very short time.", ["mw"]),
  M("EV0009", "vocab", 4, "What does 'obsequious' mean?", ["excessively eager to please or obey", "stubbornly disobedient", "deeply mysterious", "sharply critical"], "obsequious: marked by too much eagerness to help or obey.", ["mw"]),
  M("EV0010", "vocab", 4, "If someone is 'sanguine' about the future, they are:", ["optimistic", "stubborn", "gloomy", "indifferent"], "sanguine (of a person or outlook): confident and hopeful.", ["mw"]),
  { ...base("EV0011", "vocab", "link", 2, ["mw"]), q: "Match each word with its meaning.", pairs: [["candid", "frank and honest"], ["timid", "lacking courage"], ["vivid", "bright and intense"], ["rigid", "stiff, not flexible"]], exp: "candid, timid, vivid and rigid all end in -id but mean very different things." },
  { ...base("EV0012", "vocab", "link", 3, ["mw"]), q: "Match each word with its meaning.", pairs: [["benevolent", "kind and well-meaning"], ["cynical", "distrustful of others' motives"], ["pragmatic", "practical rather than idealistic"], ["eloquent", "fluent and persuasive in speech"], ["tenacious", "persistent, not giving up"]], exp: "Definitions summarized from Merriam-Webster." },
  M("EV0013", "vocab", 1, "What does 'enormous' mean?", ["very large", "very small", "very fast", "very quiet"], "enormous: extremely large.", ["mw"]),
  M("EV0014", "vocab", 4, "Which word means 'to make something less severe'?", ["mitigate", "militate", "instigate", "exacerbate"], "mitigate = lessen; militate (against) = work against; exacerbate = make worse.", ["mw"]),

  // ---------- Context ----------
  M("EC0001", "context", 1, "Choose the best word: 'It's raining heavily, so take an ___.'", ["umbrella", "envelope", "ingredient", "elevator"], "Rain → umbrella. The article 'an' also fits a word starting with a vowel sound.", ["self"]),
  M("EC0002", "context", 1, "A: 'Thanks so much for your help!'  B: '___'", ["You're welcome.", "I'm sorry to hear that.", "Nice to meet you too.", "Bless you."], "The natural reply to thanks is 'You're welcome.'", ["self"]),
  M("EC0003", "context", 2, "Choose the best word: 'She was so ___ that she fell asleep during the movie.'", ["exhausted", "exhausting", "excited", "alert"], "-ed adjectives describe how someone feels (exhausted); -ing adjectives describe what causes it (exhausting).", ["cam"]),
  M("EC0004", "context", 2, "A: 'Do you mind if I open the window?'  B: '___ It's quite warm in here.'", ["Not at all, go ahead.", "Yes, please do.", "No, I mind.", "Yes, I don't."], "'Do you mind…?' asks whether it bothers you, so agreeing means answering 'Not at all.' 'Yes' would mean you object.", ["cam"]),
  M("EC0005", "context", 2, "Choose the best word: 'The meeting was ___ because the manager was sick.'", ["postponed", "promoted", "proposed", "prohibited"], "postpone = move to a later time, which fits a sick manager.", ["mw"]),
  M("EC0006", "context", 3, "Choose the best word: 'Despite the heavy traffic, we ___ to arrive on time.'", ["managed", "succeeded", "achieved", "accomplished"], "manage takes to + verb (managed to arrive). succeed takes in + -ing (succeeded in arriving).", ["cam"]),
  M("EC0007", "context", 3, "What does the speaker mean? 'I wouldn't say no to a cup of coffee.'", ["I would like a cup of coffee.", "I don't drink coffee.", "I refuse the coffee.", "I've had too much coffee."], "'I wouldn't say no to…' is a polite, indirect way of saying you would like something.", ["cam"]),
  M("EC0008", "context", 3, "Choose the best word: 'The results were ___; nobody could have predicted them.'", ["unprecedented", "predictable", "routine", "anticipated"], "unprecedented = never done or known before, matching 'nobody could have predicted'.", ["mw"]),
  M("EC0009", "context", 4, "Choose the best word: 'His apology seemed ___; he was clearly just trying to avoid trouble.'", ["insincere", "heartfelt", "genuine", "spontaneous"], "Trying to avoid trouble suggests the apology was not genuine — insincere.", ["mw"]),
  M("EC0010", "context", 4, "Choose the best word: 'The evidence was merely ___, so the court could not rely on it alone.'", ["circumstantial", "conclusive", "irrefutable", "definitive"], "circumstantial evidence suggests a fact indirectly; 'merely' and 'could not rely on it alone' point to it.", ["mw"]),
  M("EC0011", "context", 2, "A: 'How about going to the beach this weekend?'  B: '___ The forecast says it'll be sunny.'", ["Sounds great!", "No way, I agree.", "I'm afraid so.", "Never mind."], "B accepts the suggestion and gives a reason, so 'Sounds great!' fits.", ["self"]),
  M("EC0012", "context", 4, "What is implied? 'She's not exactly the most punctual person.'", ["She is often late.", "She is always early.", "She is very precise.", "She dislikes schedules."], "'Not exactly the most…' is understatement: it politely means she is often late.", ["cam"]),

  // ---------- Idioms, phrasal verbs & collocations ----------
  M("EI0001", "idiom", 1, "Complete the idiom meaning 'very easy': 'It's a piece of ___.'", ["cake", "bread", "pie", "cookie"], "'A piece of cake' means something very easy.", ["mw", "cam"]),
  M("EI0002", "idiom", 1, "Complete the expression used to wish a performer good luck: 'Break a ___!'", ["leg", "arm", "rule", "record"], "'Break a leg!' is a theater expression meaning 'Good luck!'", ["mw"]),
  M("EI0003", "idiom", 1, "Complete the saying: 'Don't cry over spilled ___.'", ["milk", "water", "coffee", "juice"], "'Don't cry over spilled milk' means don't be upset about something that can't be undone (British: spilt).", ["mw"]),
  M("EI0004", "idiom", 2, "What does 'hit the sack' mean?", ["go to bed", "start a fight", "lose a job", "go shopping"], "'Hit the sack' is informal for going to bed.", ["mw"]),
  M("EI0005", "idiom", 2, "Complete the idiom: 'The ball is in your ___.'", ["court", "pocket", "field", "corner"], "'The ball is in your court' means it is your turn to act or decide.", ["mw", "cam"]),
  M("EI0006", "idiom", 2, "Choose the correct phrasal verb: 'Please ___ the form and return it by Friday.'", ["fill out", "fill up", "fill on", "fill at"], "In American English you 'fill out' a form (British English also says 'fill in'). 'fill up' means to make a container full.", ["mw", "cam"]),
  M("EI0007", "idiom", 3, "Choose the correct phrasal verb: 'He decided to ___ smoking for his health.'", ["give up", "give in", "give out", "give away"], "give up = stop doing a habit; give in = surrender; give away = give for free.", ["mw"]),
  M("EI0008", "idiom", 3, "What does 'bite the bullet' mean?", ["force yourself to do something unpleasant", "speak without thinking", "eat very quickly", "avoid a difficult task"], "To bite the bullet is to face a difficult or unpleasant situation bravely.", ["mw"]),
  M("EI0009", "idiom", 3, "Which collocation is natural English?", ["make a mistake", "do a mistake", "create a mistake", "build a mistake"], "English uses 'make a mistake'. 'do a mistake' is a common learner error.", ["oxl"]),
  M("EI0010", "idiom", 4, "What does 'a red herring' mean?", ["something that distracts from the real issue", "a rare and valuable object", "an embarrassing mistake", "a sign of danger"], "A red herring is something that misleads or distracts attention from the important question.", ["mw"]),
  M("EI0011", "idiom", 4, "Complete the idiom meaning 'act too soon': 'Let's not ___ the gun; we don't have all the facts yet.'", ["jump", "shoot", "fire", "pull"], "To jump the gun is to start doing something too early.", ["mw"]),
  M("EI0012", "idiom", 2, "Complete the saying: 'Better late than ___.'", ["never", "sorry", "early", "nothing"], "'Better late than never' means it is better to do something late than not at all. ('Better safe than sorry' is a different saying.)", ["mw"]),
  M("EI0013", "idiom", 4, "Choose the correct phrasal verb: 'The negotiations ___ when neither side would compromise.'", ["broke down", "broke out", "broke in", "broke through"], "break down = fail (talks, negotiations); break out = start suddenly; break through = make a discovery.", ["mw", "cam"]),

  // ---------- Pronunciation ----------
  M("ER0001", "read", 1, "Which word has a silent 'k'?", ["knife", "kitten", "kangaroo", "basket"], "In words beginning with kn-, the k is silent: knife, knee, know.", ["cam"]),
  M("ER0002", "read", 1, "Which word has a silent 'b'?", ["thumb", "rabbit", "number", "bubble"], "After m at the end of a word, b is usually silent: thumb, lamb, climb.", ["cam"]),
  M("ER0003", "read", 2, "Where is the stress in 'photographer'?", ["pho-TO-gra-pher", "PHO-to-gra-pher", "pho-to-GRA-pher", "pho-to-gra-PHER"], "PHOtograph but phoTOgrapher — adding -er moves the stress.", ["cam", "mw"]),
  M("ER0004", "read", 2, "Which word does NOT rhyme with 'though'?", ["tough", "snow", "go", "slow"], "though rhymes with go; tough rhymes with stuff. The letters -ough have several sounds.", ["cam"]),
  M("ER0005", "read", 2, "In which word is 'ch' pronounced /k/?", ["choir", "chair", "cheese", "church"], "choir is pronounced like 'kwire'; the others use the 'ch' sound.", ["cam"]),
  M("ER0006", "read", 3, "Where is the stress in the noun 'record' (a disc or a document)?", ["RE-cord", "re-CORD", "both syllables equally", "it has no stress"], "Noun: REcord. Verb: reCORD. Many two-syllable noun/verb pairs work this way.", ["cam", "mw"]),
  M("ER0007", "read", 3, "Which word has a silent 'l'?", ["salmon", "silver", "bottle", "flame"], "In salmon the l is silent, as in calm, half and walk.", ["cam"]),
  M("ER0008", "read", 3, "Which pair are homophones (same sound, different spelling)?", ["knight / night", "read (present) / read (past)", "live (verb) / live (adjective)", "bow (a ribbon) / bow (to bend)"], "knight and night sound the same. The other pairs are spelled the same but sound different.", ["cam"]),
  M("ER0009", "read", 4, "Where is the stress in 'determine'?", ["de-TER-mine", "DE-ter-mine", "de-ter-MINE", "DE-TER-mine"], "deTERmine — the second syllable is stressed, and the last syllable sounds like 'min'.", ["cam", "mw"]),
  M("ER0010", "read", 4, "How is 'colonel' pronounced?", ["like 'kernel'", "like 'colon-el'", "like 'collar-nel'", "like 'coal-nel'"], "colonel is pronounced exactly like kernel, a famous spelling oddity.", ["mw", "cam"]),
  M("ER0011", "read", 1, "Which word has a silent 'w'?", ["write", "water", "window", "swim"], "In words beginning with wr-, the w is silent: write, wrong, wrap.", ["cam"]),
  M("ER0012", "read", 2, "Which word has a silent 'h'?", ["hour", "house", "happy", "hotel"], "hour starts with a vowel sound, which is why we say 'an hour'.", ["cam"]),

  // ---------- Slang & modern expressions ----------
  M("ET0001", "trend", 1, "What does 'BRB' mean in a chat?", ["be right back", "bring real bread", "be ready by", "best regards, bye"], "BRB = be right back.", ["mw"], SLANG),
  M("ET0002", "trend", 1, "'FOMO' stands for:", ["fear of missing out", "friends of my office", "full of mixed opinions", "free online movie offer"], "FOMO = fear of missing out: anxiety that others are having fun without you.", ["mw"], SLANG),
  M("ET0003", "trend", 2, "If something is 'sus', it is:", ["suspicious", "super useful", "sustainable", "surprising"], "sus is short for suspicious (or suspect).", ["mw"], SLANG),
  M("ET0004", "trend", 2, "'No cap' means:", ["no lie / for real", "no hat allowed", "no limit", "no capital letters"], "'No cap' means 'I'm not lying' or 'for real'.", ["mw"], SLANG),
  M("ET0005", "trend", 2, "To 'ghost' someone means to:", ["suddenly stop all communication with them", "scare them as a joke", "copy their work", "follow them online secretly"], "To ghost is to end a relationship by suddenly not responding at all.", ["mw"], SLANG),
  M("ET0006", "trend", 3, "'Spill the tea' means:", ["share the gossip", "make a mess", "reveal your recipe", "calm down"], "'Tea' is slang for gossip, so 'spill the tea' means share it.", ["mw"], SLANG),
  M("ET0007", "trend", 3, "If someone says a song 'slaps', they mean it is:", ["really good", "too loud", "very old", "aggressive"], "Slang 'slaps' = is excellent.", ["mw"], SLANG),
  OX("ET0008", "trend", 3, "'IRL' means 'in real life'.", true, "IRL = in real life, as opposed to online.", ["mw"], SLANG),
  M("ET0009", "trend", 4, "'Rizz' (Oxford Word of the Year 2023) refers to:", ["charm or the ability to attract others", "anger or irritation", "a lucky guess", "nervous energy"], "rizz, likely from charisma: style, charm, or attractiveness.", ["oxwoty"], SLANG),
  M("ET0010", "trend", 4, "Calling something 'mid' means it is:", ["mediocre / just average", "in the middle of happening", "exceptionally good", "related to midnight"], "Slang mid = average or not very good.", ["mw"], SLANG),
  M("ET0011", "trend", 2, "What does 'the GOAT' mean?", ["the Greatest Of All Time", "a stubborn person", "someone Going Out After Ten", "a Guaranteed Online Ticket"], "GOAT = Greatest Of All Time.", ["mw"], SLANG),
  M("ET0012", "trend", 3, "In 'I low-key love this song', 'low-key' means:", ["secretly / somewhat", "loudly", "not at all", "definitely not"], "low-key used as an adverb means quietly, secretly or to some extent.", ["mw"], SLANG),

  // ---------- Sentence building (one order only) ----------
  ORD("EA0001", 1, "Put the proverb in order.", ["Actions", "speak", "louder", "than", "words."], "'Actions speak louder than words.' What you do matters more than what you say.", ["mw"]),
  ORD("EA0002", 1, "Put the proverb in order.", ["Practice", "makes", "perfect."], "'Practice makes perfect.'", ["mw"]),
  ORD("EA0003", 2, "Put the proverb in order.", ["Don't", "judge", "a", "book", "by", "its", "cover."], "'Don't judge a book by its cover.' Don't judge by appearance.", ["mw"]),
  ORD("EA0004", 2, "Put the question in order.", ["What", "time", "does", "the", "train", "leave?"], "Question word + auxiliary + subject + verb: What time does the train leave?", ["cam"]),
  ORD("EA0005", 2, "Put the proverb in order.", ["The", "early", "bird", "catches", "the", "worm."], "'The early bird catches the worm.' Those who start early succeed.", ["mw"]),
  ORD("EA0006", 3, "Put the sentence in order.", ["She", "has", "lived", "in Seoul", "since 2015."], "Present perfect + since + a point in time: She has lived in Seoul since 2015.", ["cam"]),
  ORD("EA0007", 3, "Put the steps of the recipe in order.", ["First, preheat the oven.", "Then, mix the flour and sugar.", "Next, pour the batter into a pan.", "Finally, bake it for 30 minutes."], "First and Finally fix the start and end. In the middle, the batter must be mixed before it can be poured, so mixing comes before pouring.", ["self"]),
  ORD("EA0008", 3, "Put the proverb in order.", ["When in Rome,", "do", "as", "the Romans", "do."], "'When in Rome, do as the Romans do.' Follow local customs.", ["mw"]),
  ORD("EA0009", 4, "Put the paragraph in a logical order.", ["Although the plan seemed simple at first,", "the team soon ran into unexpected problems.", "However, by working together,", "they finished the project ahead of schedule."], "Although… sets up a contrast, However… turns it around, and the result comes last.", ["self"]),
  ORD("EA0010", 4, "Put the paragraph in a logical order.", ["Scientists collected samples from the lake.", "They then analyzed the water in the lab.", "The results revealed high levels of pollution.", "As a result, the city closed the lake to swimmers."], "collect → analyze → results → consequence ('As a result').", ["self"]),
  ORD("EA0011", 1, "Put the saying in order.", ["Time", "is", "money."], "'Time is money.'", ["mw"]),
  ORD("EA0012", 2, "Put the question in order.", ["Could", "you", "help", "me", "with", "this?"], "Modal + subject + verb for a polite request: Could you help me with this?", ["cam"]),

  // ---------- Error spotting (exactly one error) ----------
  SPOT("EE0001", 1, ["She", "don't", "like", "coffee."], 1, "doesn't", "With he/she/it, use doesn't: She doesn't like coffee.", ["cam"]),
  SPOT("EE0002", 1, ["I", "have", "two", "childs."], 3, "children.", "child has an irregular plural: children.", ["mw"]),
  SPOT("EE0003", 2, ["He", "is", "more", "taller", "than", "his", "brother."], 2, "(delete 'more')", "taller is already comparative, so 'more' is not needed: He is taller than his brother.", ["cam"]),
  SPOT("EE0004", 2, ["Their", "going", "to", "the", "park", "later."], 0, "They're", "They're = they are: They're going to the park later.", ["mw"]),
  SPOT("EE0005", 2, ["I", "am", "looking", "forward", "to", "meet", "you."], 5, "meeting", "In 'look forward to', to is a preposition, so it takes -ing: looking forward to meeting you.", ["cam"]),
  SPOT("EE0006", 3, ["If", "I", "would have known,", "I", "would have", "called."], 2, "had known,", "Third conditional: If + had + past participle, would have + past participle.", ["cam"]),
  SPOT("EE0007", 3, ["Each", "of", "the", "students", "have", "a", "book."], 4, "has", "'Each of…' takes a singular verb: Each of the students has a book.", ["cam"]),
  SPOT("EE0008", 3, ["The", "news", "are", "surprising."], 2, "is", "news is uncountable and takes a singular verb: The news is surprising.", ["cam"]),
  SPOT("EE0009", 4, ["Neither", "the", "manager", "nor", "the", "employees", "was", "informed."], 6, "were", "With neither… nor, the verb agrees with the nearer subject (employees → were).", ["mw", "cam"]),
  SPOT("EE0010", 4, ["Less", "people", "came", "than", "we", "expected."], 0, "Fewer", "Use fewer with countable nouns (people) and less with uncountable nouns.", ["mw", "cam"]),
  SPOT("EE0011", 4, ["She", "gave", "the", "book", "to", "John", "and", "I."], 7, "me.", "After a preposition (to), use the object pronoun: to John and me.", ["cam"]),
  SPOT("EE0012", 2, ["He", "has", "been", "working", "here", "since", "three", "years."], 5, "for", "Use for with a length of time (for three years) and since with a starting point (since 2023).", ["cam"]),

  // ---------- Typing ----------
  TY("EY0001", 1, "The quick brown fox jumps over the lazy dog."),
  TY("EY0002", 1, "Small habits build strong skills."),
  TY("EY0003", 2, "Every small step counts toward a big goal."),
  TY("EY0004", 2, "Reading every day helps you think clearly."),
  TY("EY0005", 2, "Please send me the report by Friday."),
  TY("EY0006", 3, "Curiosity is the engine of lifelong learning."),
  TY("EY0007", 3, "She quietly packed her bags and left at dawn."),
  TY("EY0008", 3, "Typing fast is good, but typing right is better."),
  TY("EY0009", 4, "Extraordinary claims require extraordinary evidence."),
  TY("EY0010", 4, "The jazz quartet played until the crowd went wild."),
  TY("EY0011", 1, "Good morning, how are you today?"),
  TY("EY0012", 4, "Lightning flickered across the dark, quiet valley."),

  // ===== Batch 2 (2026-11-08) — dictionary-checked items only; slang not expanded =====
  // ---------- Spelling & usage ----------
  M("ES0016", "spell", 1, "Complete the sentence: 'I'd like ___ cups of tea, please.'", ["two", "to", "too", "tow"], "two is the number 2; to is a preposition; too means also or excessively.", ["mw", "cam"]),
  M("ES0017", "spell", 1, "Choose the correct spelling.", ["beautiful", "beatiful", "beautifull", "beutiful"], "beautiful = beauty (with the y changed to i) + -ful, which has only one l.", ["mw"]),
  M("ES0018", "spell", 2, "Complete the sentence: 'She is taller ___ her sister.'", ["than", "then", "that", "thane"], "than is used in comparisons; then refers to time or sequence.", ["mw", "cam"]),
  M("ES0019", "spell", 2, "Choose the correct spelling.", ["February", "Febuary", "Februray", "Febrary"], "February has an r after the b (Feb-ru-ary), even though many people drop it in speech.", ["mw"]),
  M("ES0020", "spell", 3, "Complete the sentence: 'The school ___ gave a speech at graduation.'", ["principal", "principle", "principel", "princible"], "principal is the head of a school (or 'main'); principle is a rule or belief.", ["mw", "cam"]),
  OX("ES0021", "spell", 3, "'Stationary' means 'not moving', while 'stationery' means writing materials such as paper and envelopes.", true, "stationary (with -ary) = not moving; stationery (with -ery) = paper, envelopes and other writing materials.", ["mw"]),
  M("ES0022", "spell", 4, "Choose the correct spelling.", ["liaison", "liason", "liasion", "laison"], "liaison has an i on both sides of the a: l-i-a-i-s-o-n.", ["mw"]),
  M("ES0023", "spell", 4, "Choose the correct spelling.", ["indispensable", "indispensible", "indespensable", "indispensabel"], "indispensable ends in -able, not -ible.", ["mw"]),
  M("ES0024", "spell", 2, "Complete the sentence: 'Thanks for your ___ on my essay.'", ["advice", "advise", "advize", "adviced"], "advice (with c) is the noun; advise (with s) is the verb.", ["mw", "cam"]),

  // ---------- Vocabulary ----------
  M("EV0015", "vocab", 1, "What does 'ancient' mean?", ["very old", "very new", "very loud", "very small"], "ancient means belonging to the very distant past, or very old.", ["mw"]),
  M("EV0016", "vocab", 2, "What does 'tedious' mean?", ["long and boring", "fast and exciting", "small and delicate", "bright and colorful"], "tedious means tiresome because of length or dullness.", ["mw"]),
  M("EV0017", "vocab", 2, "Which word is a synonym of 'abundant'?", ["plentiful", "scarce", "hidden", "fragile"], "abundant means existing in large quantities, the same as plentiful. scarce is its opposite.", ["mw"]),
  M("EV0018", "vocab", 3, "What does 'resilient' mean?", ["able to recover quickly from difficulties", "easily broken or damaged", "unwilling to change", "extremely shy"], "resilient means able to recover quickly from difficult conditions, or to spring back into shape.", ["mw", "oxl"]),
  M("EV0019", "vocab", 3, "Which word is an antonym of 'verbose'?", ["concise", "wordy", "loud", "elaborate"], "verbose means using more words than needed; concise means short and clear. wordy is a synonym.", ["mw"]),
  M("EV0020", "vocab", 4, "What does 'laconic' mean?", ["using very few words", "extremely lazy", "full of hidden meaning", "easily angered"], "laconic means using few words, from the Laconians (Spartans), who were famous for brief speech.", ["mw"]),
  M("EV0021", "vocab", 4, "What does 'perfunctory' mean?", ["done quickly without real care or interest", "done perfectly", "required by law", "performed in public"], "perfunctory describes an action done only as a routine duty, with little care or interest.", ["mw", "oxl"]),

  // ---------- Context ----------
  M("EC0013", "context", 1, "Choose the best word: 'I'm hungry. Let's get something to ___.'", ["eat", "sleep", "read", "wear"], "Being hungry leads naturally to getting something to eat.", ["self"]),
  M("EC0014", "context", 1, "A: 'Sorry I'm late.'  B: '___'", ["No problem, we just started.", "You're welcome.", "Nice to meet you.", "See you later."], "An apology is answered with reassurance such as 'No problem'. 'You're welcome' answers thanks, not an apology.", ["self"]),
  M("EC0015", "context", 2, "Choose the best word: 'The store was ___, so we had to come back the next day.'", ["closed", "open", "cheap", "new"], "Having to come back another day means they couldn't shop, so the store was closed.", ["self"]),
  M("EC0016", "context", 2, "Choose the best word: 'He spoke so ___ that everyone in the back row could hear him clearly.'", ["loudly", "quietly", "rarely", "briefly"], "If people far away could hear him clearly, he must have spoken loudly.", ["self"]),
  M("EC0017", "context", 3, "What does the speaker mean? 'I could hardly keep my eyes open.'", ["I was very sleepy.", "I was very angry.", "My eyes were hurting.", "I was very surprised."], "'Could hardly keep my eyes open' means the speaker was so tired that their eyes kept closing.", ["cam"]),
  M("EC0018", "context", 4, "Choose the best word: 'The new evidence ___ his earlier claim, proving he had told the truth.'", ["corroborated", "contradicted", "fabricated", "undermined"], "corroborate means to confirm or support with evidence, which fits 'proving he had told the truth'.", ["mw"]),
  M("EC0019", "context", 4, "Choose the best word: 'After weeks of ___, the two companies finally signed the agreement.'", ["negotiation", "celebration", "hesitation", "decoration"], "Companies reach an agreement after negotiation (formal discussion to settle terms).", ["mw"]),

  // ---------- Idioms & phrasal verbs ----------
  M("EI0014", "idiom", 1, "Complete the saying: 'An apple a day keeps the ___ away.'", ["doctor", "teacher", "baker", "farmer"], "The saying means eating healthy food keeps you from getting sick.", ["cam"]),
  M("EI0015", "idiom", 1, "What does 'under the weather' mean?", ["feeling slightly sick", "standing outside in the rain", "very happy", "in trouble with the police"], "under the weather means slightly ill.", ["mw", "cam"]),
  M("EI0016", "idiom", 2, "Complete the idiom meaning 'stop working for today': 'Let's call it a ___.'", ["day", "job", "rest", "break"], "call it a day means to stop the work you are doing, usually until the next day.", ["mw", "cam"]),
  M("EI0017", "idiom", 2, "Choose the correct phrasal verb: 'Can you ___ my cat while I'm on vacation?'", ["look after", "look up", "look into", "look over"], "look after means take care of. look up = search for information; look into = investigate; look over = examine quickly.", ["cam", "oxl"]),
  M("EI0018", "idiom", 3, "What does 'once in a blue moon' mean?", ["very rarely", "every month", "only at night", "when someone is sad"], "once in a blue moon means very rarely.", ["mw", "cam"]),
  M("EI0019", "idiom", 3, "What does 'cost an arm and a leg' mean?", ["be very expensive", "cause a serious injury", "take a very long time", "be very cheap"], "cost an arm and a leg means to be extremely expensive.", ["mw", "cam"]),
  M("EI0020", "idiom", 4, "What does 'beat around the bush' mean?", ["avoid talking about the main point", "work extremely hard", "search everywhere", "win very easily"], "beat around the bush means to avoid saying something directly.", ["mw", "cam"]),
  M("EI0021", "idiom", 4, "Complete the saying: 'Don't count your chickens before they ___.'", ["hatch", "fly", "grow", "sleep"], "The saying warns not to rely on a good result before it has actually happened.", ["mw", "cam"]),

  // ---------- Pronunciation ----------
  M("ER0013", "read", 1, "Which word has a silent 'g'?", ["sign", "goat", "bag", "glass"], "In sign the g is not pronounced (it sounds like 'sine').", ["mw"]),
  M("ER0014", "read", 2, "Where is the stress in 'banana'?", ["ba-NA-na", "BA-na-na", "ba-na-NA", "All syllables are equal"], "banana is stressed on the second syllable: ba-NA-na.", ["mw", "cam"]),
  M("ER0015", "read", 2, "In which word is 'gh' pronounced /f/?", ["laugh", "night", "though", "ghost"], "gh sounds like f in laugh. It is silent in night and though, and sounds like g in ghost.", ["mw"]),
  M("ER0016", "read", 3, "Where is the stress in 'economy'?", ["e-CON-o-my", "EC-o-no-my", "e-co-NO-my", "e-con-o-MY"], "economy is stressed on the second syllable: e-CON-o-my (compare EC-o-NOM-ic).", ["mw", "cam"]),
  M("ER0017", "read", 3, "Which word has a silent 't'?", ["listen", "tent", "start", "little"], "In listen the t is silent (LIS-en).", ["mw"]),
  M("ER0018", "read", 4, "Which word has the same vowel sound as 'blood'?", ["flood", "food", "good", "mood"], "blood and flood both have the short u sound /ʌ/. food and mood use /uː/; good uses /ʊ/.", ["mw", "cam"]),
  M("ER0019", "read", 4, "How is 'Wednesday' usually pronounced?", ["WENZ-day (the first d is silent)", "WED-nes-day, with every letter sounded", "WEED-nes-day", "WED-day"], "In standard pronunciation, the first d in Wednesday is silent: WENZ-day.", ["mw", "cam"]),

  // ---------- Sentence building ----------
  ORD("EA0013", 1, "Put the saying in order.", ["Better", "safe", "than", "sorry."], "'Better safe than sorry' — it is wiser to be careful than to take a risk and regret it.", ["cam"]),
  ORD("EA0014", 1, "Put the question in order.", ["Where", "do", "you", "live?"], "A wh-question starts with the question word, then the auxiliary do, the subject and the main verb.", ["self"]),
  ORD("EA0015", 2, "Put the proverb in order.", ["Honesty", "is", "the", "best", "policy."], "'Honesty is the best policy' — telling the truth is always the wisest choice.", ["cam"]),
  ORD("EA0016", 2, "Put the proverb in order.", ["Two", "heads", "are", "better", "than", "one."], "'Two heads are better than one' — two people working together solve problems better than one alone.", ["cam"]),
  ORD("EA0017", 3, "Put the sentence in order.", ["I", "have", "never been", "to", "Japan."], "In the present perfect, never goes between have and the past participle: I have never been to Japan.", ["cam"]),
  ORD("EA0018", 3, "Put the steps in order.", ["First, fill the kettle with water.", "Next, boil the water.", "Then, pour it over the tea bag.", "Finally, let the tea steep for three minutes."], "Fill, boil, pour and steep can only happen in this order.", ["self"]),
  ORD("EA0019", 4, "Put the paragraph in a logical order.", ["The city built a new bike lane last spring.", "Since then, more people have started cycling to work.", "This has reduced traffic in the downtown area.", "Officials now plan to add more lanes next year."], "Event → 'Since then' result → 'This' refers back to the result → future plan.", ["self"]),

  // ---------- Error spotting ----------
  SPOT("EE0013", 1, ["He", "go", "to", "school", "every", "day."], 1, "goes", "With he/she/it in the simple present, the verb takes -s: he goes.", ["cam"]),
  SPOT("EE0014", 1, ["I", "seen", "that", "movie", "yesterday."], 1, "saw", "The simple past of see is saw. seen is the past participle and needs have: I have seen.", ["cam"]),
  SPOT("EE0015", 2, ["There", "is", "many", "books", "on", "the", "shelf."], 1, "are", "The subject is the plural 'many books', so the verb is are: There are many books.", ["cam"]),
  SPOT("EE0016", 2, ["She", "has", "a", "lot", "of", "homeworks", "to", "do."], 5, "homework", "homework is an uncountable noun, so it has no plural -s.", ["cam", "oxl"]),
  SPOT("EE0017", 3, ["The", "team", "played", "good", "in", "the", "final."], 3, "well", "To describe how someone played, use the adverb well, not the adjective good.", ["mw", "cam"]),
  SPOT("EE0018", 3, ["Whom", "is", "calling", "at", "this", "hour?"], 0, "Who", "The word is the subject of 'is calling', so it must be who. whom is used for objects.", ["mw", "cam"]),
  SPOT("EE0019", 4, ["The", "price", "of", "gas", "has", "raised", "again."], 5, "risen", "rise (go up by itself) has the past participle risen. raise needs an object: They have raised the price.", ["mw", "cam"]),

  // ---------- Typing ----------
  TY("EY0013", 1, "Have a great day at school."),
  TY("EY0014", 2, "The library opens at nine in the morning."),
  TY("EY0015", 3, "Patience and practice turn effort into skill."),
  TY("EY0016", 3, "A warm breeze drifted through the open window."),
  TY("EY0017", 4, "Quietly, the old clock ticked away the hours."),

  // ===== Batch 3 (2026-11-08) — about 200 items per language =====
  M("ES0025", "spell", 1, "Choose the correct spelling.", ["friend", "freind", "frend", "friendd"], "friend is spelled with ie: f-r-i-e-n-d.", ["mw"]),
  M("ES0026", "spell", 2, "Complete the sentence: 'I don't know ___ she will come or not.'", ["whether", "weather", "wether", "whather"], "whether introduces a choice between possibilities; weather means the conditions outside (rain, sun).", ["mw", "cam"]),
  M("ES0027", "spell", 3, "Which word for 'a regular, repeated pattern of beats' is spelled correctly?", ["rhythm", "rythm", "rhythym", "rhytm"], "rhythm has an h after both r and t, and no vowel letter between th and m.", ["mw"]),
  OX("ES0028", "spell", 4, "Dictionaries such as Merriam-Webster label 'irregardless' as nonstandard; 'regardless' is the standard word.", true, "irregardless is recorded in dictionaries but labeled nonstandard. In formal writing, use regardless.", ["mw"]),
  M("EV0022", "vocab", 1, "What does 'fragile' mean?", ["easily broken", "very heavy", "very fast", "brightly colored"], "fragile means easily broken or damaged.", ["mw"]),
  M("EV0023", "vocab", 2, "Which word is a synonym of 'brave'?", ["courageous", "timid", "lazy", "clumsy"], "brave and courageous both mean showing no fear of danger. timid is the opposite.", ["mw"]),
  M("EV0024", "vocab", 3, "What does 'gregarious' mean?", ["fond of company; sociable", "afraid of crowds", "very greedy", "easily irritated"], "gregarious means enjoying the company of others, from Latin grex (flock).", ["mw"]),
  M("EV0025", "vocab", 4, "What does 'recalcitrant' mean?", ["stubbornly uncooperative", "extremely calm", "easily frightened", "deeply religious"], "recalcitrant describes someone who stubbornly resists authority or control.", ["mw", "oxl"]),
  M("EC0020", "context", 1, "Choose the best word: 'It's very dark in here. Can you turn on the ___?'", ["light", "radio", "door", "chair"], "In a dark room you turn on the light.", ["self"]),
  M("EC0021", "context", 2, "A: 'Would you like some more cake?'  B: '___ I'm full.'", ["No, thank you.", "Yes, please!", "Here you are.", "Good luck!"], "Saying 'I'm full' means the speaker is declining, so 'No, thank you' fits.", ["self"]),
  M("EC0022", "context", 3, "Choose the best word: 'Although she was nervous, she gave a ___ speech that impressed everyone.'", ["confident", "boring", "short-tempered", "careless"], "Although contrasts her nervousness with the speech, and 'impressed everyone' points to a positive word: confident.", ["self"]),
  M("EC0023", "context", 4, "What does the speaker mean? 'I'll believe it when I see it.'", ["I doubt it will really happen.", "I'm sure it will happen.", "I can't see very well.", "I have already seen it."], "The expression shows doubt: the speaker won't believe something until they see proof.", ["cam"]),
  M("EI0022", "idiom", 2, "Complete the saying: 'Every cloud has a silver ___.'", ["lining", "coin", "spoon", "ring"], "Every bad situation has some good side to it.", ["mw", "cam"]),
  M("EI0023", "idiom", 1, "What does 'keep an eye on' mean?", ["watch carefully", "close your eyes", "fall asleep", "make a mistake"], "keep an eye on someone or something means to watch them carefully.", ["cam"]),
  M("EI0024", "idiom", 3, "Choose the correct phrasal verb: 'The meeting was ___ until next Monday.'", ["put off", "put on", "put up", "put out"], "put off means postpone. put on = wear or start a device; put up = build or let stay; put out = extinguish.", ["cam", "oxl"]),
  M("EI0025", "idiom", 4, "What does 'the elephant in the room' mean?", ["an obvious problem that nobody wants to talk about", "a very large person", "a surprise guest", "a noisy argument"], "The elephant in the room is a big, obvious issue that people avoid discussing.", ["mw", "cam"]),
  M("ER0020", "read", 1, "Which word has a silent 'c'?", ["scissors", "cat", "cent", "cold"], "In scissors, sc is pronounced /s/, so the c is silent.", ["mw"]),
  M("ER0021", "read", 2, "Where is the stress in 'hotel'?", ["ho-TEL", "HO-tel", "Both syllables equally", "There is no stress"], "hotel is stressed on the second syllable: ho-TEL.", ["mw", "cam"]),
  M("ER0022", "read", 3, "Which word rhymes with 'bear'?", ["hair", "hear", "beer", "her"], "bear and hair share the same vowel sound /er/. hear and beer have /ir/.", ["mw", "cam"]),
  ORD("EA0020", 1, "Put the proverb in order.", ["Look", "before", "you", "leap."], "'Look before you leap' — think carefully before you act.", ["cam"]),
  ORD("EA0021", 2, "Put the proverb in order.", ["Rome", "wasn't", "built", "in", "a", "day."], "'Rome wasn't built in a day' — important things take time.", ["cam"]),
  ORD("EA0022", 3, "Put the story in order.", ["Last weekend, we went hiking in the mountains.", "Unfortunately, it started to rain,", "so we returned home early."], "Setting → 'Unfortunately' problem → 'so' result.", ["self"]),
  SPOT("EE0020", 1, ["She", "can", "swims", "very", "fast."], 2, "swim", "After a modal verb such as can, use the base form: can swim.", ["cam"]),
  SPOT("EE0021", 2, ["He", "didn't", "went", "to", "work", "today."], 2, "go", "After did or didn't, use the base form of the verb: didn't go.", ["cam"]),
  SPOT("EE0022", 3, ["The", "number", "of", "applicants", "were", "smaller", "than", "expected."], 4, "was", "The subject is 'the number', which is singular, so the verb is was. (Compare: A number of applicants were late.)", ["mw", "cam"]),
  SPOT("EE0023", 3, ["The", "committee", "has", "made", "it's", "decision."], 4, "its", "The possessive is its; it's always means it is or it has.", ["mw", "cam"]),
  SPOT("EE0024", 4, ["Scarcely", "had", "we", "arrived", "than", "it", "began", "to", "rain."], 4, "when", "The pattern is 'scarcely … when'. 'than' is used with 'no sooner': No sooner had we arrived than it began to rain.", ["mw", "cam"]),
  TY("EY0018", 2, "Bring a jacket in case it gets cold."),
  TY("EY0019", 4, "Bright stars shimmered above the silent harbor."),
];
