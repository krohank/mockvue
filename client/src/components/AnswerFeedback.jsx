import React from 'react';

export const feedbackPending = (answer) => ['pending', 'processing'].includes(answer?.evaluationStatus);
export const hasRubricScore = (answer) => answer && !feedbackPending(answer) && !answer.isFallbackEvaluation && answer.evaluationProvider === 'local' && typeof answer.overallScore === 'number';
const List = ({ title, items }) => items?.length ? <div><h3 className="text-sm font-semibold mb-2">{title}</h3><ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null;

export function AnswerFeedback({ answer, question, showGuide = true }) {
  if (!answer) return null;
  const pending = feedbackPending(answer);
  const basic = !answer.skipped && (answer.isFallbackEvaluation || answer.evaluationKind === 'concept-check');
  const guide = answer.improvedAnswer || question?.referenceAnswer;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-xl font-semibold">{pending ? 'Answer saved' : answer.skipped ? 'Question skipped' : basic ? 'Answer review' : 'Answer feedback'}</h2>
      {hasRubricScore(answer) && <span className="text-2xl font-semibold text-[#7A263A] dark:text-[#D4AA6A]">{answer.overallScore}<span className="text-sm font-normal"> / 100</span></span>}
      {basic && <span className="text-xs rounded-full border px-3 py-1">Guided practice · ungraded</span>}
    </div>
    {pending ? <p role="status" className="text-sm leading-relaxed">Feedback is being prepared. You can continue to the next question; your answer is already saved. The results page will update when feedback is ready.</p> : <>
      <p className="text-sm leading-relaxed">{answer.feedback}</p>
      {basic && <p className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">No correctness score was assigned. The checklist only detects reference terms; a mention can still be wrong, and valid paraphrases can be missed.</p>}
      {answer.evaluationProvider === 'local' && <p className="text-xs text-[#68645E] dark:text-[#9E988F]">Graded by a local model. Check its reasoning; model feedback can be wrong.</p>}
      <div className="grid sm:grid-cols-2 gap-5">
        <List title={basic ? 'Reference terms mentioned' : 'What the answer covers'} items={basic ? answer.mentionedConcepts : answer.correctConcepts} />
        <List title={basic ? 'Reference terms not detected' : 'Points to develop'} items={answer.missingConcepts} />
      </div>
      <List title="Errors identified by the model" items={answer.mistakes} />
      {!basic && answer.explanation && <p className="text-sm leading-relaxed">{answer.explanation}</p>}
    </>}
    {showGuide && guide && <div className="border-t border-[#DED9D0] dark:border-[#332F2A] pt-5 space-y-2"><h3 className="text-sm font-semibold">{answer.answerSource === 'local-model' || question?.answerSource === 'local-model' ? 'Model-generated study answer' : 'Worked study answer'}</h3><p className="text-sm leading-7 whitespace-pre-wrap">{guide}</p><p className="text-xs text-[#68645E] dark:text-[#9E988F]">One possible approach. Other correct explanations and designs are valid.</p></div>}
    <List title="Try these follow-up questions" items={answer.followUpQuestions?.length ? answer.followUpQuestions : question?.followUpQuestions} />
  </div>;
}
