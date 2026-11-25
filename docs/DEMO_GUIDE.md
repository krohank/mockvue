# MockVue demo guide

## 1. Before the demo (do this the day before)

1. Work from a copy that is NOT inside OneDrive, for example `C:\dev\mockvue`. OneDrive can lock or corrupt the local MongoDB files in `.local-data\mongodb`.
2. From the project root run `npm run install:all`.
3. Run the tests and the build, and note the numbers:
   - `npm test --prefix server`
   - `npm test --prefix client`
   - `npm run test:speech --prefix server`
   - `npm run build:client`
4. Check `server\.env` has `AI_PROVIDER=rules`.
5. Start everything with `npm run dev`. The server log should say `Grading provider: rules`, and it logs `[Grading] Re-scoring N saved answer(s)...` if older answers needed scoring.
6. Open http://localhost:5000/api/health. The `ai` block should show `effectiveProvider: rules` and `available: true`.
7. Do one voice test so the Whisper model is loaded and cached before the audience arrives.
8. Commit and push so GitHub matches what you demo: `git add -A`, `git commit -m "Local rubric checker"`, `git push`.

## 2. Settings to use on the day

- Mode: **Practice** (Assessment mode ends the interview if you leave fullscreen or switch tabs).
- Pick Technical, Medium, 3 questions, 20 minutes. Answer every question; skipped questions count as zero in the overall score.
- Have a second browser tab already open on the History page.

## 3. Five-minute flow

1. **Setup (30 s):** choose Frontend Developer or Software Developer, pick topics, create the interview.
2. **Check your setup (30 s):** show the microphone test and explain that audio is transcribed locally and never leaves the machine.
3. **Answer 1 by typing (1 min):** use the strong answer below.
4. **Answer 2 by voice (1 min):** record, stop, show the editable transcript, edit one word, submit.
5. **Answer 3:** use the weak answer below to show the score drops.
6. **Results (2 min):** show the overall score, the four criteria, open a question and show which rubric points were matched or missing, the quoted evidence, and the worked answer.
7. **History and Progress:** show that scores are saved and averaged.

## 4. Answers that behave predictably

These were scored by the checker on the question "Compare the ANSI SQL transaction isolation levels..." (Database Management Systems, Hard). Type them only if that question appears; otherwise answer in full sentences using the terms from the worked answer.

| Answer | Score |
|---|---|
| Read uncommitted allows dirty reads. Read committed stops dirty reads but still allows non-repeatable reads. Repeatable read stops those but phantom rows can appear. Serializable runs transactions as if one after another. MVCC gives each transaction a snapshot while two phase locking uses locks. | 100 / 100 |
| Isolation levels decide how much transactions can see of each other. Higher levels are safer but slower. | 3 / 100 |
| dirty reads non-repeatable reads phantom reads snapshot isolation MVCC 2PL serializable | 13 / 100 (a list of terms is capped) |
| I like football and cooking pasta at home on weekends with my family and friends. | 1 / 100 |

A structured story for a Behavioural question (situation, goal, what you did, result, lesson, with numbers) scored 81 in testing; a vague one ("I am a hard worker...") scored 0.

## 5. Questions you will probably be asked

- **Why no LLM?** Marks from a model vary between runs, need a GPU, and cannot be explained. A 9B model did not fit in 8 GB of VRAM on this laptop. The rubric checker is deterministic, runs offline, and shows why every point was given.
- **How accurate is it?** It measures overlap with the saved answer, not correctness. It has not been compared with human graders. A correct answer in very different wording can be under-scored. The worked answer is shown beside every score for that reason.
- **Can I trick it?** A list of keywords is capped, a known false claim costs marks, and an answer with fewer than two key terms scores 0. Fluent text that misuses the right terms can still earn some credit.
- **Where does the data go?** Nowhere. Speech, scoring and the database run on the same machine.
- **What would you do next?** Benchmark the scores against faculty-marked answers, then tune the weights.

## 6. If something breaks

- Score missing or "Ungraded": restart the server; answers saved earlier are re-scored on start-up.
- Port in use: close the other process on 5000 or 5173.
- Microphone not working: type the answer instead. The transcript is editable either way.
- Database will not start: stop `npm run dev`, make sure the project is not in OneDrive, then start again.
