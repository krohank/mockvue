import React from 'react';

export const feedbackPending = (answer) => ['pending', 'processing'].includes(answer?.evaluationStatus);
// A score counts when a real rubric produced it: the local rubric checker (provider "rules")
// or an optional local model. Checklist-only reviews never count.
export const hasRubricScore = (answer) => answer && !feedbackPending(answer) && !answer.isFallbackEvaluation
  && (answer.evaluationProvider === 'local' || (answer.evaluationProvider === 'rules' && answer.evaluationKind === 'rule-based'))
  && typeof answer.overallScore === 'number';
const List = ({ title, items }) => items?.length ? <div><h3 className="text-sm font-semibold mb-2">{title}</h3><ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null;

const STATUS = {
  matched: { label: 'Covered', className: 'text-[#3F6B52] dark:text-[#88BA9D]' },
  mentioned: { label: 'Partly', className: 'text-[#A66A24] dark:text-[#DEAC74]' },
  missing: { label: 'Not found', className: 'text-[#7A263A] dark:text-[#D98B9B]' },
  contradicted: { label: 'Check this', className: 'text-[#7A263A] dark:text-[#D98B9B]' },
};
const CRITERIA = [['technicalCorrectness', 'Accuracy / evidence', 40], ['relevance', 'Relevance', 20], ['completeness', 'Completeness', 20], ['clarity', 'Clarity', 20]];

const Points = ({ title, items }) => items.length ? <div>
  <h3 className="text-sm font-semibold mb-2">{title}</h3>
  <ul className="space-y-2 text-sm leading-relaxed">{items.map((item, i) => {
    const status = STATUS[item.status] || STATUS.missing;
    return <li key={i} className="flex gap-3"><span className={'shrink-0 w-20 text-xs font-semibold pt-0.5 ' + status.className}>{status.label}</span>
      <span className="text-[#68645E] dark:text-[#9E988F]"><span className="text-[#171717] dark:text-[#F7F4EE]">{item.point}</span>{item.status === 'contradicted' && item.note ? ' — ' + item.note : ''}{item.evidence && item.status !== 'missing' ? <em className="block text-xs mt-0.5">Your words: “{item.evidence}”</em> : null}</span></li>;
  })}</ul></div> : null;

export function AnswerFeedback({ answer, question, showGuide = true }) {
  if (!answer) return null;
  const pending = feedbackPending(answer);
  const basic = !answer.skipped && (answer.isFallbackEvaluation || answer.evaluationKind === 'concept-check');
  const rubric = answer.evaluationProvider === 'rules' && !basic;
  const guide = answer.improvedAnswer || question?.referenceAnswer;
  const points = answer.rubricResults || [];
  const story = points.some((p) => p.group !== 'detail' && /^(Situation|Task or goal|Action|Result|Reflection):/.test(p.point));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-xl font-semibold">{pending ? 'Answer saved' : answer.skipped ? 'Question skipped' : basic ? 'Answer review' : 'Answer feedback'}</h2>
      {hasRubricScore(answer) && <span className="text-2xl font-semibold text-[#7A263A] dark:text-[#D4AA6A]">{answer.overallScore}<span className="text-sm font-normal"> / 100</span></span>}
      {basic && <span className="text-xs rounded-full border px-3 py-1">Study review · no score</span>}
    </div>
    {pending ? <p role="status" className="text-sm leading-relaxed">Your answer is being scored against the saved answer. You can continue to the next question; it is already saved and this page updates when the score is ready.</p> : <>
      <p className="text-sm leading-relaxed">{answer.feedback}</p>
      {basic && <p className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">No score was assigned. The checklist only detects reference terms; a mention can still be wrong, and valid paraphrases can be missed.</p>}
      {rubric && <>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">{CRITERIA.map(([key, label, max]) => <div key={key}><dt className="text-xs text-[#68645E] dark:text-[#9E988F]">{label}</dt><dd className="text-lg font-semibold">{answer.criteriaScores?.[key] ?? 0}<span className="text-xs font-normal"> / {max}</span></dd></div>)}</dl>
        <p className="text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">Scored by the local rubric checker (no AI model). {typeof answer.coveragePercent === 'number' ? 'About ' + answer.coveragePercent + '% of the saved answer’s key terms appear in your answer. ' : ''}It compares your wording with the saved answer, so a valid answer in very different vocabulary can be under-scored.</p>
      </>}
      {answer.evaluationProvider === 'local' && <p className="text-xs text-[#68645E] dark:text-[#9E988F]">Graded by a local model. Check its reasoning; model feedback can be wrong.</p>}
      {rubric && points.length > 0 ? <div className="grid gap-5">
        <Points title={story ? 'Story structure' : 'Key concepts'} items={points.filter((p) => p.group !== 'detail')} />
        <Points title={story ? 'Topic coverage' : 'Details from the saved answer'} items={points.filter((p) => p.group === 'detail')} />
      </div> : <div className="grid sm:grid-cols-2 gap-5">
        <List title={basic ? 'Reference terms mentioned' : 'What the answer covers'} items={basic ? answer.mentionedConcepts : answer.correctConcepts} />
        <List title={basic ? 'Reference terms not detected' : 'Points to develop'} items={answer.missingConcepts} />
      </div>}
      <List title="Statements to double-check" items={answer.mistakes} />
      {!basic && !rubric && answer.explanation && <p className="text-sm leading-relaxed">{answer.explanation}</p>}
    </>}
    {showGuide && guide && <div className="border-t border-[#DED9D0] dark:border-[#332F2A] pt-5 space-y-2"><h3 className="text-sm font-semibold">{answer.answerSource === 'local-model' || question?.answerSource === 'local-model' ? 'Model-generated study answer' : 'Saved answer (what your answer is compared with)'}</h3><p className="text-sm leading-7 whitespace-pre-wrap">{guide}</p><p className="text-xs text-[#68645E] dark:text-[#9E988F]">One possible approach. Other correct explanations and designs are valid.</p></div>}
    <List title="Try these follow-up questions" items={answer.followUpQuestions?.length ? answer.followUpQuestions : question?.followUpQuestions} />
  </div>;
}
