import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { buildDoc } from "./lib/doc";
import { buildDocx, type CollectedProblem } from "./lib/docx";
import { collectCourseInPage } from "./lib/collector";
import { grabCodeInPage, grabQuestionInPage } from "./lib/pageCapture";
import { runInActiveTab, storage } from "./lib/storage";
import type { Draft, Entry, Profile, StoredState } from "./types";

const defaultProfile: Profile = { college: "Vishnu Institute of Technology :: Bhimavaram", subject: "Python Programming", reg: "R-23", year: "2026-27", name: "JETTI JANAKI", roll: "25PA1A0593", cls: "CSE-B" };
const emptyDraft: Draft = { question: "", output: "", code: "" };
const profileFields: Array<keyof Profile> = ["college", "subject", "reg", "year", "name", "roll", "cls"];

function App() {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [topic, setTopic] = useState("");
  const [chapterFilter, setChapterFilter] = useState("Making Decisions");
  const [collectedProblems, setCollectedProblems] = useState<CollectedProblem[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>({ text: "" });

  useEffect(() => {
    storage.get().then((state: StoredState) => {
      setProfile({ ...defaultProfile, ...state.profile });
      setDraft({ ...emptyDraft, ...state.draft });
      setEntries(state.entries ?? []);
      setCollectedProblems((state.collectedProblems ?? []) as CollectedProblem[]);
      setTopic(state.topic ?? "");
    }).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not load saved data.", true));
  }, []);

  const topics = useMemo(() => [...new Set(entries.map((entry) => entry.topic))], [entries]);
  function notify(text: string, error = false) { setMessage({ text, error }); window.setTimeout(() => setMessage({ text: "" }), 3500); }
  async function save(patch: StoredState) { await storage.set(patch); }
  async function updateDraft(field: keyof Draft, value: string) { const next = { ...draft, [field]: value }; setDraft(next); await save({ draft: next }); }
  async function captureQuestion() {
    try {
      const result = await runInActiveTab(grabQuestionInPage);
      if (!result.foundButton) return notify("Could not find the question heading. Open MentorPick's Description tab.", true);
      const next = { ...draft, question: result.question, output: result.output };
      setDraft(next); await save({ draft: next });
      notify(result.examples ? "Question and sample output captured." : "Question captured; no examples were found.", !result.examples);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not read the active tab.", true); }
  }
  async function captureCode() {
    try {
      const result = await runInActiveTab(grabCodeInPage);
      if (!result.found) return notify("Code editor not found. Open a submission first.", true);
      await updateDraft("code", result.code); notify(`Code captured (${result.code.split("\n").length} lines).`);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not read the active tab.", true); }
  }
  async function addEntry() {
    if (!draft.question || !draft.code) return notify("Capture both the question and code first.", true);
    const entry = { ...draft, topic: topic.trim() || "General" };
    const index = entries.findIndex((item) => item.topic === entry.topic && item.question === entry.question);
    const next = [...entries];
    if (index >= 0) next[index] = entry; else next.push(entry);
    setEntries(next); setCollectedProblems([]); setDraft(emptyDraft); await save({ entries: next, draft: emptyDraft, collectedProblems: [] }); notify(index >= 0 ? "Entry updated." : `Added entry ${next.length}.`);
  }
  function downloadDocument() {
    if (!entries.length) return notify("Add at least one problem first.", true);
    const url = URL.createObjectURL(new Blob(["\ufeff", buildDoc(profile, entries)], { type: "application/msword" }));
    const link = document.createElement("a"); link.href = url; link.download = "MentorPick_Record.doc"; link.click(); URL.revokeObjectURL(url);
  }
  async function clearAll() {
    if (!window.confirm("Remove all captured problems?")) return;
    setEntries([]); setCollectedProblems([]); setDraft(emptyDraft); await save({ entries: [], draft: emptyDraft, collectedProblems: [] }); notify("All captured problems removed.");
  }
  async function collectCourse() {
    try {
      notify("Collecting course data. This is read-only and may take a few minutes.");
      const result = await runInActiveTab(collectCourseInPage, ["6a643039af8ff368d7872d24", chapterFilter.trim()]);
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "problems.json"; link.click(); URL.revokeObjectURL(url);
      notify(`Collected ${result.problems.length} problems${result.issues.length ? ` with ${result.issues.length} issues` : "."}`, Boolean(result.issues.length));
    } catch (error) { notify(error instanceof Error ? error.message : "Could not collect course data.", true); }
  }
  async function importProblems(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { problems?: CollectedProblem[] };
      if (!Array.isArray(parsed.problems)) throw new Error("This file does not contain a problems array.");
      const imported = parsed.problems.map((problem) => ({
        topic: String(problem.chapter ?? "General"),
        question: String(problem.description ?? problem.title ?? ""),
        code: String(problem.student_code ?? ""),
        output: Array.isArray(problem.examples) ? problem.examples.map((example) => `Input:\n${String(example.input ?? "")}\nOutput:\n${String(example.output ?? "")}`).join("\n\n") : ""
      }));
      setCollectedProblems(parsed.problems);
      setEntries(imported);
      await save({ entries: imported, draft: emptyDraft, collectedProblems: parsed.problems as Array<Record<string, unknown>> });
      notify(`Imported ${imported.length} problems. Review the entries, then download the document.`);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not import problems.json.", true); }
  }
  async function downloadDocx() {
    if (!entries.length) return notify("Import problems.json or add a problem first.", true);
    try {
      const problems = collectedProblems.length ? collectedProblems : entries.map((entry) => ({ chapter: entry.topic, title: entry.question, description: entry.question, student_code: entry.code, examples: entry.output ? [{ output: entry.output }] : [] }));
      const blob = await buildDocx(profile, problems);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "MentorPick_Record.docx"; link.click(); URL.revokeObjectURL(url);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not create DOCX.", true); }
  }

  return <main className="app">
    <header><div><span className="eyebrow">STUDENT TOOL</span><h1>VJ CRAFT</h1></div><span className="count">{entries.length} saved</span></header>
    {message.text && <div className={`message ${message.error ? "error" : "success"}`}>{message.text}</div>}
    <details className="card"><summary>Cover page details</summary><div className="form-grid">{profileFields.map((field) => <label key={field}>{field === "cls" ? "Class & Section" : field.toUpperCase()}<input value={profile[field]} onChange={async (event) => { const next = { ...profile, [field]: event.target.value }; setProfile(next); await save({ profile: next }); }} /></label>)}</div></details>
    <section className="card"><div className="card-title"><h2>Problem details</h2><span className="hint">Step 1</span></div><label>Topic / chapter<input list="topics" value={topic} onChange={async (event) => { setTopic(event.target.value); await save({ topic: event.target.value }); }} placeholder="e.g. Speak to the Machine" /></label><datalist id="topics">{topics.map((item) => <option key={item} value={item} />)}</datalist><button onClick={captureQuestion}>Capture question + sample output</button><textarea value={draft.question} onChange={(event) => updateDraft("question", event.target.value)} placeholder="Question / aim" /><textarea value={draft.output} onChange={(event) => updateDraft("output", event.target.value)} placeholder="Sample output" /></section>
    <section className="card"><div className="card-title"><h2>Submitted solution</h2><span className="hint">Step 2</span></div><button onClick={captureCode}>Capture code from editor</button><textarea className="code" value={draft.code} onChange={(event) => updateDraft("code", event.target.value)} placeholder="Python source code" /></section>
    <button className="primary" onClick={addEntry}>+ Add problem to document</button>
    <section className="card"><div className="card-title"><h2>Document</h2><span className="hint">{entries.length} problems</span></div><div className="entry-list">{entries.map((entry, index) => <div className="entry" key={`${entry.topic}-${entry.question}`}><span><b>{index + 1}. {entry.question}</b><small>{entry.topic}</small></span><button className="icon" title="Remove" onClick={async () => { const next = entries.filter((_, itemIndex) => itemIndex !== index); setEntries(next); await save({ entries: next }); }}>×</button></div>)}</div><div className="actions"><button onClick={downloadDocument}>Download .doc</button><button onClick={downloadDocx}>Download .docx</button><button className="danger" onClick={clearAll}>Clear all</button></div><label>Import collected problems.json<input type="file" accept=".json,application/json" onChange={importProblems} /></label><label>Collector chapter filter (blank = all chapters)<input value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)} placeholder="Making Decisions" /></label><button className="collect" onClick={collectCourse}>Collect course data (read-only)</button></section>
  </main>;
}

export default App;
