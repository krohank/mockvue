import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, Download, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { AnswerFeedback, feedbackPending, hasRubricScore } from '../components/AnswerFeedback';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const InterviewResultsPage = () => {
  const { id } = useParams(), { user } = useAuth();
  const [data, setData] = useState(null), [error, setError] = useState(''), [expanded, setExpanded] = useState(0), [events, setEvents] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    api.get('/interviews/' + id + '/report', { signal: controller.signal }).then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    api.get('/interviews/' + id + '/monitoring', { signal: controller.signal }).then((r) => setEvents(r.events || [])).catch(() => {});
    return () => controller.abort();
  }, [id]);
  const pending = data?.report?.some((r) => feedbackPending(r.answer));
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let timer, delay = 2500;
    const poll = async () => {
      try { const r = await api.get('/interviews/' + id + '/report', { signal: controller.signal }); if (!controller.signal.aborted) setData(r); } catch {}
      if (!controller.signal.aborted) { delay = Math.min(delay * 2, 10000); timer = setTimeout(poll, delay); }
    };
    timer = setTimeout(poll, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [id, pending]);
  const recoverDraft = (questionId) => {
    try { const draft = JSON.parse(localStorage.getItem('mockvue_draft_' + user?._id + '_' + id + '_' + questionId) || 'null'); return typeof draft?.text === 'string' ? draft.text : ''; } catch { return ''; }
  };
  if (error) return <div className="max-w-xl mx-auto px-5 py-16 space-y-4"><h1 className="font-serif text-3xl">Results unavailable</h1><p role="alert">{error}</p><Link to="/dashboard"><Button>Back to dashboard</Button></Link></div>;
  if (!data) return <div className="min-h-[60vh] flex items-center justify-center"><Spinner label="Loading results…" /></div>;
  const { interview, report = [] } = data;
  const answered = report.filter((r) => r.answer && !r.answer.skipped), graded = answered.filter((r) => hasRubricScore(r.answer));
  const guided = answered.filter((r) => r.answer.isFallbackEvaluation || r.answer.evaluationKind === 'concept-check');
  const score = interview.overallScore, numeric = typeof score === 'number' && interview.scoreStatus === 'graded';
  const download = () => {
    const blob = new Blob([JSON.stringify({ interview, report, unsubmittedDrafts: report.filter((r) => !r.answer && recoverDraft(r.question._id)).map((r) => ({ questionId: r.question._id, text: recoverDraft(r.question._id), scored: false })) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'mockvue-report-' + id + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
    <div className="flex flex-wrap justify-between items-start gap-6 border-b border-[#DED9D0] dark:border-[#332F2A] pb-7">
      <div className="space-y-3"><Link className="text-sm hover:underline" to="/history">← Interview history</Link><div className="flex flex-wrap gap-2"><Badge variant="brand">{interview.difficulty}</Badge><Badge>{interview.interviewType}</Badge><Badge>{pending ? 'Scoring in progress' : guided.length ? 'Study review' : graded.length ? 'Rubric-scored' : 'No answers scored'}</Badge></div><h1 className="font-serif text-3xl sm:text-4xl font-bold">{interview.targetRole}</h1><p className="text-sm text-[#68645E] dark:text-[#9E988F]">{new Date(interview.completedAt).toLocaleDateString()} · {answered.length} answered · {report.filter((r) => r.answer?.skipped).length} skipped · {report.filter((r) => !r.answer).length} unanswered</p></div>
      <Card className="!p-5 text-center min-w-[180px]"><p className="text-xs mb-2">{numeric ? 'Overall score' : 'Review status'}</p><p className="font-serif text-3xl font-semibold text-[#7A263A] dark:text-[#D4AA6A]">{numeric ? score + '%' : pending ? 'Scoring…' : 'Not scored'}</p><p className="text-xs mt-2">{graded.length} {graded.length === 1 ? 'answer' : 'answers'} scored by the rubric checker</p></Card>
    </div>
    {interview.terminationReason && <p role="alert" className="mv-alert">Session ended early: {interview.terminationReason}</p>}
    {pending && <p role="status" className="text-sm leading-relaxed">Your answers are saved and are being scored against the saved answers. This page updates automatically.</p>}
    {guided.length > 0 && <Card className="!p-5 text-sm leading-relaxed">{guided.length} {guided.length === 1 ? 'answer has' : 'answers have'} a reference-term checklist and the saved answer but no score, because there was no saved answer to compare with or the answer was saved before the rubric checker ran. Restart the server to have saved answers re-scored.</Card>}
    {numeric && <p className="text-sm text-[#68645E] dark:text-[#9E988F]">The overall score averages all {report.length} questions. Skipped and unanswered questions contribute zero. Scores come from a local rubric checker that compares your wording with each saved answer. They are practice estimates, not a hiring prediction.</p>}
    {graded.length > 0 && <Card className="!p-5 space-y-4"><h2 className="font-serif text-xl font-semibold">Score breakdown · {graded.length} scored {graded.length === 1 ? 'answer' : 'answers'}</h2><div className="grid grid-cols-2 sm:grid-cols-4 gap-5">{[['technicalCorrectness', 'Accuracy / evidence', 40], ['relevance', 'Relevance', 20], ['completeness', 'Completeness', 20], ['clarity', 'Clarity', 20]].map(([key, label, max]) => <div key={key}><p className="text-xs mb-1">{label}</p><p className="text-xl font-semibold">{(graded.reduce((sum, r) => sum + r.answer.criteriaScores[key], 0) / graded.length).toFixed(1)}<span className="text-sm font-normal"> / {max}</span></p></div>)}</div></Card>}
    <div className="flex flex-wrap gap-3 print:hidden"><Button variant="outline" icon={Download} onClick={download}>Download data</Button><Button variant="outline" icon={Printer} onClick={() => window.print()}>Print report</Button><Link to="/interviews/new"><Button icon={ArrowRight}>Practice again</Button></Link></div>
    <div className="space-y-4"><h2 className="font-serif text-2xl font-semibold">Question review</h2>{report.map(({ question, answer }, index) => {
      const open = expanded === index, draft = !answer && recoverDraft(question._id);
      return <Card key={question._id} className="!p-0 overflow-hidden"><button onClick={() => setExpanded(open ? -1 : index)} aria-expanded={open} aria-controls={'review-' + index} className="w-full flex items-start justify-between gap-4 text-left p-5 sm:p-6"><span className="space-y-2"><span className="block text-xs text-[#68645E] dark:text-[#9E988F]">Question {index + 1} · {question.topic} · {question.difficulty}</span><span className="block font-serif text-lg font-semibold">{question.questionText}</span><span className="block text-xs">{!answer ? 'Unanswered' : answer.skipped ? 'Skipped' : feedbackPending(answer) ? 'Saved · scoring…' : hasRubricScore(answer) ? answer.overallScore + ' / 100' : 'Study review · no score'}</span></span>{open ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}</button>
        <div id={'review-' + index} className={(open ? '' : 'hidden print:block ') + 'p-5 sm:p-6 pt-0 space-y-6'}>
          {answer && !answer.skipped && <div className="rounded-lg bg-[#F7F4EE] dark:bg-[#141210] p-4 space-y-2"><h3 className="text-sm font-semibold">Your {answer.responseType === 'voice' ? 'reviewed transcript' : 'answer'}</h3><p className="text-sm leading-7 whitespace-pre-wrap break-words">{answer.responseText}</p></div>}
          {answer ? <AnswerFeedback answer={answer} question={question} /> : <div className="space-y-4"><p className="text-sm">No answer was submitted for this question.</p>{draft && <div className="space-y-2"><h3 className="text-sm font-semibold">Unsubmitted draft from this device · not graded</h3><p className="text-sm whitespace-pre-wrap">{draft}</p></div>}{question.referenceAnswer && <div className="space-y-2"><h3 className="text-sm font-semibold">Saved answer</h3><p className="text-sm leading-7">{question.referenceAnswer}</p></div>}</div>}
        </div></Card>;
    })}</div>
    {events.length > 0 && <Card className="!p-5 space-y-3"><h2 className="font-serif text-xl font-semibold">Session events</h2><ul className="space-y-2 text-sm">{events.map((event) => <li key={event._id}>{event.eventType.replace(/_/g, ' ')} · {event.description}</li>)}</ul></Card>}
  </div>;
};
