# Mechanic research for Alésia mini-games

Scope: 8+ browser mini-games (React, 1-3 minutes each), playable on a projector with class voting and on a phone alone. Visual language: Rome = red squares, Gaul = green circles.

Research status and caveats:
- Sources are mostly review and interview pages surfaced by search, plus Wikipedia and Wikipedia-style pages fetched for detail. Several GDC talks are cited by title only; I did not get transcripts or slides.
- No r/gamedesign, r/truegaming or BoardGameGeek threads were returned by search, so the "why players find it compelling" points rest on developer interviews and reviews, not forum discussion. A follow-up pass on those forums is still needed.
- A search for Hnefatafl hit a rate limit. Its rules came from the Wikipedia Hnefatafl page instead.
- Kahoot's Wikipedia page does not describe the in-class mechanic (timed questions, speed points). That detail is general knowledge, not verified here.
- Items marked (unverified) came from a single search snippet.

---

## 1. Reigns (swipe left/right decisions, four meters)

**Core loop.** Each card shows a short scene with a yes/no choice. Swiping left or right picks one option, and each option moves one or more of four meters (in the original: church, people, army, treasury). The reign ends when a meter empties or fills, and the deck supplies the next card.

**Why players find it compelling.** The swipe removes most interaction friction, so one life takes a minute or two and players try many lives. Reviewers describe it as a Tinder-like loop. The meters make cause and effect visible while the individual cards stay surprising. One review notes that the game shows which meters a choice touches but not by how much, which keeps players guessing. Sources: [PC Gamer, "How Reigns and its sequel make their 'Tinderocracy' work"](https://www.pcgamer.com/au/how-reigns-and-its-forthcoming-sequel-make-their-tinderocracy-work); [Endless Mode, "Reigns offers grand strategy by way of Tinder"](https://www.endlessmode.com/video-games/reigns/reigns-offers-grand-strategy-by-way-of-tinder); [AV Club, same title](https://www.avclub.com/reigns-offers-grand-strategy-by-way-of-tinder); [Game Developer design deep dive on adaptive narrative](https://gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-).

**What goes wrong when shrunk or used educationally.** Binary choices flatten historical nuance into "good button or bad button". Players quickly learn which answer is "safe", so the choice stops being a choice. Card writing has to be strong, and a 3-minute game has room for only a handful of cards, so each one carries a lot of weight. Hidden meter magnitudes can also make a class feel the game is arbitrary rather than explainable.

**Alésia mapping.** Caesar is the player. Four meters: Legions (red), Grain (red), Senate (red), Allies (green). Each card is a moment from the siege, such as a Gallic sortie at dawn, a deserter asking for food, or an envoy offering surrender. Teach one lesson per card: each swipe must cost something on a different meter. To stop it being a coin flip, show the meter that moves but not how much, then reveal the historical outcome after the class votes.

---

## 2. Into the Breach (telegraphed enemy attacks, small grid, perfect information)

**Core loop.** A small grid (8x8). Enemies ("Vek") show their intended attack direction and target before the player acts. The player moves three mechs, pushing or blocking enemies so their telegraphed attacks hit nothing or hit each other. The battle lasts a fixed number of turns.

**Why players find it compelling.** Because enemy intent is fully visible, every loss feels like the player's fault. The developers said telegraphing made the game feel like a puzzle, and they cut randomness out of the player's options. Subset's developer notes say telegraphing "further helped to hasten the pace". Sources: [Wikipedia, Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach); [GDC 2019 talk "Into the Breach Design Postmortem" (Matthew Davis, Subset Games), listed on GDC Vault](https://gdcvault.com/) (title only, transcript not reviewed); [Game Developer, "Road to the IGF: Subset Games' Into the Breach"](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-).

**What goes wrong when shrunk or used educationally.** The 8x8 grid with three units is already small; shrinking further removes the strategic depth. Students may learn to solve the puzzle without learning the history. The telegraphed information has to be the historically true information, or the game teaches a false picture. A time-limited version loses the fixed-turn structure that makes it feel readable.

**Alésia mapping.** The siege as an 8x8 grid. Roman lines appear as red squares (wall segments, towers, camps). Gallic relief armies appear as green circles arriving from one or more edges. Each turn, the game shows the direction and target of each relief attack (the telegraph), and the player places or pushes three Roman cohorts to block it before the relief force breaks through. The historical anchor is that Caesar knew the relief force was coming and had to hold two fronts at once. A fixed number of turns (say, the time Caesar had before the relief army attacked) keeps it to 2-3 minutes.

---

## 3. Mini Metro / Mini Motorways (draw lines under constraints)

**Core loop.** A map of stations appears. The player draws lines between stations to carry passengers, under limits on line count, train count or road length. The city grows, new station shapes appear, and the game ends when a station overflows.

**Why players find it compelling.** Simple drawing makes complexity emerge. The developers said Mini Motorways was "too similar to Mini Metro", so they changed the constraints (for example, road length is capped in Mini Motorways but not in Mini Metro) while keeping the core of drawing lines. Dinosaur Polo Club's technical designer Tana Tanoi spoke at GDC 2023 about the "Wuselfaktor" (the charm of busy, lively motion) (unverified, from a single search snippet). Sources: [Twinfinite, Mini Motorways developer interview](https://twinfinite.net/2021/07/mini-motorways-interview-dinosaur-polo-club-talks-aesthetics-traffic-their-name/); [Game Developer, "Mini Motorways and the delicate art of marrying complexity and minimalism"](https://gamedeveloper.com/audio/-i-mini-motorways-i-and-the-delicate-art-of-marrying-complexity-and-minimalism); [Wikipedia, Mini Metro](https://en.wikipedia.org/wiki/Mini_Metro_(video_game)); [Dinosaur Polo Club, dev chat part two](https://dinopoloclub.com/2023/07/20/a-chat-with-the-devs-part-two/).

**What goes wrong when shrunk or used educationally.** A realistic city has too many stations for a 2-minute projector game, and small station shapes become unreadable from the back of a room. Pure optimisation can make the historical content feel like decoration. The mechanic works well on a phone (drawing with a finger), but the projector view needs bigger targets.

**Alésia mapping.** Caesar's circumvallation (the ring of walls around Alésia) drawn in red. The player connects forts (red squares) with a wall line that must close around the hilltop. The constraint is a wall-length budget, based on the historical figure: Caesar's account gives about 11 Roman miles (roughly 16 km) for the inner line, so the player has a limited ink budget. Gallic camps (green circles) appear outside the ring and the wall must avoid them. A missed gap is a visible failure. Win condition: a closed line before the budget runs out.

---

## 4. Papers, Please (inspecting documents for discrepancies)

**Core loop.** Each arriving traveller presents papers, and the player checks them against the day's rule list. The player admits, denies or detains, and uses tools (question, demand documents, fingerprint check, body scan) when something does not match. Mistakes lead to fines, and the end of day shows whether the family can pay rent.

**Why players find it compelling.** Lucas Pope said the passport check was "tense" enough to build a game around, and he wrote the narrative afterwards. The discrepancy hunt is a small puzzle every time, and the moral weight came from the mechanics rather than from explicit story. Pope said he did not set out to make an empathy game. Sources: [Wikipedia, Papers, Please](https://en.wikipedia.org/wiki/Papers,_Please); [Papers Please Wiki, Discrepancies](https://papersplease.fandom.com/wiki/Discrepancies); [Kocik, "Discrepancy Detected" (gamevironments, 2020)](https://journals.suub.uni-bremen.de/index.php/gamevironments/article/view/87). I did not find the GDC talk transcript or Pope's postmortems.

**What goes wrong when shrunk or used educationally.** The rule book is the hard part. Teaching a daily rule set takes longer than 3 minutes. The game also invites a gotcha tone (catch the liar), which may turn into a lesson about suspicion rather than history. Without the family-budget frame, the moral pressure disappears.

**Alésia mapping.** Gallic envoys and deserters arrive at the Roman camp gate, and the Roman guard checks their tokens or lists against the day's orders. Example rule: "Aedui envoys may pass; Arverni are held." Discrepancy example: a seal that is the wrong tribe, or a hostage tally that does not match. Use green circles for the envoys (a shape the player checks) and red squares for the Roman rules card. The card should stay in the historical record: Caesar used hostages and envoys in exactly this way.

---

## 5. Frostpunk / This War of Mine (rationing, moral dilemmas under scarcity)

**Core loop.** Frostpunk: track fuel and food, make decisions that shape the city's laws. This War of Mine: each night assign survivors to scavenge, cook and sleep, and face moral choices in event scenes. Scarcity forces trade-offs every turn.

**Why players find it compelling.** The developers framed it this way: in This War of Mine the goal was "to survive as a small group"; in Frostpunk the question is "what people are capable of when it comes to survival of an entire community". A review notes that hardly any player aims for dictatorship, yet many end up there. Deaths in This War of Mine appear on a notice board rather than as cutscenes, so the meaning comes from other characters. Sources: [Game Press, "Forced evil: on moral choices in video games" (developer interviews)](https://www.gamepressure.com/editorials/fifth-dont-kill-on-moral-dilemmas-in-video-games/forced-evil/zf4b9); [IGC 2018, "Empathize with Numbers: the process of Frostpunk scenario writing"](https://www.invenglobal.com/articles/6528/igc-2018-empathize-with-numbers-the-process-of-frostpunk-scenario-writing); [Game Developer, "Ethically designing unethical worlds"](https://gamedeveloper.com/design/ethically-designing-unethical-worlds); [Slant Magazine, Frostpunk review](https://www.slantmagazine.com/games/review/frostpunk).

**What goes wrong when shrunk or used educationally.** Two or three resource meters are already a lot for 90 seconds. Citizens as numbers keeps pacing tense but weakens attachment. Moral choices can become moralising, where the game signals the "right" answer. Slant notes a tension between the scarcity theme and players being able to unlock almost everything quickly.

**Alésia mapping.** The besieged Gauls inside Alésia ran out of food. Caesar's account (Gallic War 7.77-78, paraphrased) describes the defenders expelling the non-combatants of the town, who were then refused passage by both sides and died between the lines. Use this as the central dilemma: a granary meter (green circles, the people) against a garrison meter (green circles, the warriors). Each night the player divides grain between warriors and non-combatants, or chooses to expel them. The Roman side can be a red-square siege meter (the ring tightens each day). Show the historical outcome with the choice, not a verdict.

---

## 6. Hnefatafl / tafl games (asymmetric siege board game)

**Core loop.** A square board with a king and defenders in the centre, attackers outside. The king (or defenders) must reach an escape square (corner or edge, by variant); attackers block and capture by sandwiching. Piece counts are asymmetric, usually about two attackers to one defender.

**Why players find it compelling.** The asymmetry is the attraction: the two sides want opposite things and the rules decide the balance. Wikipedia reports that the commonly accepted Ard Rí rules are solved with defenders always winning, and that Tablut's modern rules were distorted by a mistranslation (the 1811 translation required four attackers to capture the king; the original required two on opposite sides in most places). Newer translations are cited as roughly balanced. Balance can be tuned by changing corner-only escape, attacker camps, or the king's weapons. Sources: [Wikipedia, Hnefatafl](https://en.wikipedia.org/wiki/Hnefatafl) (fetched for rules and balance). I did not get a design writeup on balance.

**What goes wrong when shrunk or used educationally.** Rule variants differ, so a class can learn one set and be confused by another. Some variants are solved and always won by one side, which undermines the siege metaphor. Rules need reading, which is slow on a projector.

**Alésia mapping.** Use a 7x7 board (Brandubh-like, 5 vs 8 pieces, or Ard Rí-like, 16 vs 8 plus king). Romans are red squares (attackers, about two to one). Vercingetorix is a green circle at the centre, which is the Gallic side's king. The escape condition is the relief army breaking the ring to reach the edge, which is historically the goal. Use corner-only escape to keep it balanced, and show the variant rule on the first screen so the class is not confused. The reversal is useful for teaching: in the siege the defenders are inside and the relief force is outside.

---

## 7. Bad North (minimalist real-time tower defence on islands)

**Core loop.** Small islands, few units, real-time with pause. Viking raiders arrive by longship from the edges, the player places soldiers on the island to hold them, and each island takes about 5-6 minutes to clear (developer figure from a Nintendo interview).

**Why players find it compelling.** Readability: the minimalist visuals make enemy and unit state obvious at a glance. Each unit is simulated, so players cannot micromanage each soldier, and the fight plays out on its own, which the developers said made it more accessible. Touch-friendly controls suit handhelds. Sources: [Nintendo UK interview, April 2018](https://www.nintendo.co.uk/News/2018/April/Interview-Taking-on-hordes-of-invading-Vikings-in-Bad-North-1368315.html); [Medium, Oskar Stålberg and Richard Meredith on developing Bad North](https://medium.com/subpixelfilms-com/a-minimal-brand-of-madness-oskar-st%C3%A5lberg-and-richard-meredith-on-the-development-of-bad-north-514d5cf1a7a1); [Nintendo Life, "Battling the viking horde with Bad North dev Plausible Concept"](https://www.nintendolife.com/news/2018/05/feature_battling_the_viking_horde_with_bad_north_dev_plausible_concept).

**What goes wrong when shrunk or used educationally.** Real-time with pause is hard to read on a projector, and a class of 30 cannot share one pause decision. Procedural runs make it hard to compare results across the class. Without strong readability, the arrival of enemies can feel random.

**Alésia mapping.** Each "island" is a Roman camp or fort (red squares). Gallic relief forces (green circles) arrive from the edges of the screen. The player places cohorts on the camp to repel them, with a short pause-and-plan phase per wave, then sees the historical outcome. Use fixed waves (not procedural) so the whole class plays the same scenario and can compare answers in a vote.

---

## 8. Wordle, GeoGuessr and Kahoot

**Wordle.** Core loop: one puzzle per day, six guesses, colour feedback, and a shareable spoiler-free grid. Why it works, per the sources: one puzzle a day is deliberately scarce, the shared word makes solo play communal, and the grid lets players brag without spoilers. Sources: [Northeastern-linked piece on Wordle design](https://damore-mckim.northeastern.edu/news/what-makes-wordle-so-g-r-e-a-t); [Desirability Lab, Wordle daily puzzle](https://desirabilitylab.com/backfill/backfill-2025-98-wordle-daily-puzzle); [UX Magazine, "The fascinating psychology tricks that make Wordle so addictive"](https://uxmag.com/articles/the-fascinating-psychology-tricks-that-make-wordle-so-addictive). Shrunk or educational risk: the answer is a word, and history answers do not map to letters; the guess feedback can be too coarse. Alésia mapping: "guess the year" or "guess the place" with six tries, where each guess returns red (too early, Roman side) or green (too late), with the same colour logic as Wordle.

**GeoGuessr.** Core loop: a Street View location, a map guess, and a distance-based score across five rounds. Why it works: clue-reading (architecture, road signs, landscapes) makes it a detective game, and it has a large competitive scene. The sources describe 40 million accounts by 2022 and a quiz mode added with Seterra. Sources: [Wikipedia, GeoGuessr](https://en.wikipedia.org/wiki/GeoGuessr). Shrunk or educational risk: the core needs a rich real-world image, which history lacks; a single guess per round can feel like luck. Alésia mapping: "place the Roman camp on a map of Gaul" with score by distance in km, with a clue card (a line of Caesar's text) before each round. Green circle for the Gallic guess, red square for the Roman guess, scored against the real site.

**Kahoot.** Core loop: timed multiple-choice questions projected in class, phones as controllers, faster correct answers earn more points. Why it works: the class sees the answer distribution, and the time pressure makes it lively. The research cited in the Kahoot article: a 2020 literature review of 93 studies found a positive effect on classroom dynamics, learning and anxiety, and a 2023 meta-analysis (41 studies, 5,071 participants) found a large effect for gamified learning in general (Hedges' g = 0.822). These cover gamification broadly, not Kahoot specifically. Sources: [Wikipedia, Kahoot!](https://en.wikipedia.org/wiki/Kahoot!). Shrunk or educational risk: speed rewards quick clicking over thought, and the leaderboard can reward luck. Alésia mapping: a vote with four answers, coloured as red square or green circle, that shows the class split before revealing the historical answer. Pair it with a pause for reasoning, so the vote is a discussion starter rather than a race.

---

## 9. Other short, elegant mechanics for educational history games

- **Roll-and-write from Roll Through the Ages.** A Gaming the Past post describes a class roll-and-write built on dice rolls with risky resource choices, a split between dice pool and scoring, record-sheet upkeep, power-ups and storage limits, with historical content layered on the structure. A related post, *Cursus Honorum*, is a Roman Republic political competition roll-and-write. Sources: [Gaming the Past, roll-and-write post](https://gamingthepast.net/2021/11/05/making-a-roll-and-write-for-history-class-using-roll-through-the-ages-as-a-guide/); [Gaming the Past, game design category](https://gamingthepast.net/category/game-design/). Alésia use: a dice-based supply-line roll-and-write for the siege.
- **Board game for students (prototype and playtest).** A teacher-education rubric has students build a board game where rules and setbacks represent historical change, then test it with peers. Source: [Teacher-education rubric, "Learning Goals & Products"](https://rails-app-14138-187ec6c2-36j6cpg8.onporter.run/designs/28602/rubrics). Alésia use: students design the Gallic relief rule and the class plays it.
- **Historia (paper simulation).** A curriculum-aligned middle-school social-studies simulation that teaches world history, economics and geography through play. Source: [Edutopia, "A short, happy history of Historia"](https://www.edutopia.org/blog/short-happy-history-of-historia-rick-brennan/). Alésia use: a one-round economic model of grain and labour during the siege.
- **Weekly strategy game with reflection (Roman history course).** A professor pairs each session with a reflection step to connect play to historical learning. Source: [Society for History Education, M21 Spalding (PDF)](https://www.societyforhistoryeducation.org/pdfs/M21_Spalding.pdf). Alésia use: the game ends with a written or spoken reflection prompt on the chosen answer.

---

## Summary of fit for Alésia

| Game style | Best Alésia fit | Projector | Phone |
|---|---|---|---|
| Reigns | Caesar's choices across 4 meters | Good (one card) | Excellent |
| Into the Breach | Relief force telegraph, block with cohorts | Good (8x8) | Good |
| Mini Metro | Circumvallation wall with budget | Medium (needs big targets) | Excellent |
| Papers, Please | Gate checks for Gallic envoys | Good | Good |
| Frostpunk / TWoM | Rationing and expulsion of non-combatants | Good | Good |
| Tafl | 7x7 siege, Romans vs Gauls | Good | Medium |
| Bad North | Camp defence against relief waves | Medium (real-time) | Good |
| Wordle / GeoGuessr / Kahoot | Guess the year or place, class vote | Excellent | Excellent |

Recommended first build order for 8 games: Reigns, Into the Breach, Mini Metro, Papers Please, Frostpunk-style rationing, tafl, a Kahoot-style vote, and a GeoGuessr-style map guess.
