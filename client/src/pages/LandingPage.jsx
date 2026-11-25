import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const scoreExample = [
  { label: 'Correctness', score: 36, max: 40 },
  { label: 'Relevance', score: 18, max: 20 },
  { label: 'Completeness', score: 16, max: 20 },
  { label: 'Clarity', score: 18, max: 20 },
];
const steps = [
  { title: 'Set up your interview', description: 'Choose a role, topics, difficulty, and time limit.' },
  { title: 'Answer the questions', description: 'Type, record or upload your answer. Review the transcript before submitting.' },
  { title: 'Review your results', description: 'Compare your answers with worked solutions. A local rubric checker scores every answer against the saved answer; no AI model or API key is needed.' },
];
const topics = ['Data structures & algorithms', 'Databases', 'Operating systems', 'Computer networks', 'System design', 'Web development'];

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const practicePath = isAuthenticated ? '/interviews/new' : '/register';

  return (
    <div className="bg-[#F7F4EE] dark:bg-[#141210] text-[#171717] dark:text-[#F7F4EE]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-[#7A263A] dark:text-[#D4AA6A] mb-5">Mock interviews</p>
            <h1 className="max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-[1.08]">
              Practice technical interviews.
            </h1>
            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#68645E] dark:text-[#9E988F]">
              Pick a role and topics. Answer timed questions, then review worked solutions and feedback.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={practicePath}>
                <Button size="lg" icon={ArrowRight}>{isAuthenticated ? 'New interview' : 'Start practicing'}</Button>
              </Link>
              <Link to={isAuthenticated ? '/dashboard' : '/login'}>
                <Button variant="outline" size="lg">{isAuthenticated ? 'Dashboard' : 'Sign in'}</Button>
              </Link>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">
              Type or record your answers. Camera and full screen are optional in practice mode.
            </p>
          </div>

          <aside id="feedback" aria-labelledby="example-heading" className="lg:col-span-5 scroll-mt-24 rounded-xl border border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#1C1916] shadow-paper">
            <div className="p-5 sm:p-6 border-b border-[#DED9D0] dark:border-[#332F2A]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#68645E] dark:text-[#9E988F]">
                <h2 id="example-heading" className="font-medium">Example score breakdown</h2>
                <span>Databases · Medium</span>
              </div>
              <p className="mt-4 text-xl font-serif font-semibold leading-snug">
                How do database indexes speed up queries?
              </p>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-3 mb-6">
                <span className="text-sm text-[#68645E] dark:text-[#9E988F]">Answer score</span>
                <span className="font-serif text-3xl font-bold text-[#7A263A] dark:text-[#D4AA6A]">
                  88 <span className="text-base font-normal text-[#68645E] dark:text-[#9E988F]">/ 100</span>
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-5 text-[#68645E] dark:text-[#9E988F]">Illustrative score. Real scores compare your wording with each question’s saved answer and show which key points you covered.</p>
              <dl className="space-y-4">
                {scoreExample.map(({ label, score, max }) => (
                  <div key={label}>
                    <div className="flex justify-between gap-3 text-xs mb-1.5">
                      <dt>{label}</dt>
                      <dd className="font-mono text-[#68645E] dark:text-[#9E988F]">{score} / {max}</dd>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F0ECE4] dark:bg-[#24201C] overflow-hidden">
                      <div className="h-full rounded-full bg-[#7A263A] dark:bg-[#D4AA6A]" style={{ width: (score / max) * 100 + '%' }} />
                    </div>
                  </div>
                ))}
              </dl>
              <div className="mt-6 pt-5 border-t border-[#DED9D0] dark:border-[#332F2A]">
                <p className="text-xs font-semibold mb-1.5">What to improve</p>
                <p className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">
                  You explained how indexes reduce lookups. Add an example of the extra work they create when data changes.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#1C1916]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">How it works</h2>
          <ol className="mt-8 grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map(({ title, description }, index) => (
              <li key={title}>
                <span className="font-mono text-sm text-[#7A263A] dark:text-[#D4AA6A]">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-serif font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="topics" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Choose what to practice</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F] max-w-md">
              Focus on a specific topic or mix several in one interview. Your history keeps past answers and results together.
            </p>
            <Link to={practicePath} className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-[#7A263A] dark:text-[#D4AA6A] hover:underline">
              Set up an interview <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 self-start">
            {topics.map((topic) => (
              <li key={topic} className="py-3 text-sm border-b border-[#DED9D0] dark:border-[#332F2A]">{topic}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};
