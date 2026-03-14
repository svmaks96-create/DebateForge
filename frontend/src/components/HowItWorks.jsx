import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'debateforge_tutorial_seen';

export default function HowItWorks() {
  const [expanded, setExpanded] = useState(() => {
    return !localStorage.getItem(STORAGE_KEY);
  });

  function handleDismiss() {
    setExpanded(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  function toggle() {
    setExpanded(prev => !prev);
  }

  return (
    <div className="border border-gray-700/50 rounded-xl bg-white/[0.02] overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          {expanded ? (
            <>
              <span className="text-base font-semibold text-gray-200">Welcome to DebateForge</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">AI council deliberation platform — click to learn more</span>
          )}
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 text-sm text-gray-400 leading-relaxed">
          <div>
            <h3 className="text-gray-300 font-medium mb-1">What is this?</h3>
            <p>
              DebateForge assembles a council of 2-6 AI experts who deliberate on any topic you give them.
              Each expert has a unique background and perspective — their positions aren't assigned,
              they emerge naturally from who they are.
            </p>
          </div>

          <div>
            <h3 className="text-gray-300 font-medium mb-1">How to use it</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-gray-400">
              <li>Enter a topic or question (e.g., "Is NVIDIA a good investment?" or "Should our team adopt Kubernetes?")</li>
              <li>Optionally add context to focus the discussion</li>
              <li>Pick a format: <span className="text-gray-300">Quick Take</span> (1 round, ~2 min), <span className="text-gray-300">Rapid Assessment</span> (2 rounds), <span className="text-gray-300">Standard</span> (3 rounds), or <span className="text-gray-300">Deep Dive</span> (5 rounds)</li>
              <li>Configure your council: auto-generate experts or pick from the persona library</li>
              <li>Hit <span className="text-gray-300">Start</span> and watch them deliberate in real-time</li>
            </ol>
          </div>

          <div>
            <h3 className="text-gray-300 font-medium mb-1">What you get</h3>
            <p>
              After deliberation, each expert states their final position. Then a synthesizer produces
              a theme-based analysis showing where the council agreed, disagreed, and what insights emerged.
              With <span className="text-gray-300">Evidence Mode</span> on, agents search the web for real sources.
              With <span className="text-gray-300">Verification</span> on, an independent fact-checker audits the claims.
            </p>
          </div>

          <div>
            <h3 className="text-gray-300 font-medium mb-1">Tips</h3>
            <p>
              Start with "Standard" format and 3-4 council members. Add context to get more focused analysis.
              Try the auto-generate council feature — it creates diverse, relevant experts for your topic.
            </p>
          </div>

          <div className="pt-1">
            <button
              onClick={handleDismiss}
              className="px-4 py-1.5 text-xs font-medium text-gray-400 border border-gray-700 rounded-lg hover:text-gray-200 hover:border-gray-600 transition-colors cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
