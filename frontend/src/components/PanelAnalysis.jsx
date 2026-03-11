import { Users, Star, AlertTriangle } from 'lucide-react';

function ScoreBar({ label, pro, con }) {
  const max = Math.max(pro, con, 1);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-blue-400/70 w-6">PRO</span>
          <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500/60"
              style={{ width: `${(pro / 10) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-5 text-right">{pro}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400/70 w-6">CON</span>
          <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500/60"
              style={{ width: `${(con / 10) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-5 text-right">{con}</span>
        </div>
      </div>
    </div>
  );
}

// Safely extract a string value — handles both string and {pro, con} dict shapes
function extractString(val) {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    if (val.pro && val.con) return `Pro: ${val.pro} / Con: ${val.con}`;
    return JSON.stringify(val);
  }
  return null;
}

// Safely extract a {pro, con} numeric pair
function extractScores(val) {
  if (val && typeof val === 'object' && typeof val.pro === 'number' && typeof val.con === 'number') {
    return { pro: val.pro, con: val.con };
  }
  return null;
}

export default function PanelAnalysis({ panelDynamics, agents }) {
  if (!panelDynamics) return null;

  const findAgent = (val) => {
    if (!val || !agents?.length) return null;
    // Handle both string prefix ("A") and dict ({pro: "A", con: "B"}) shapes
    if (typeof val === 'string') {
      return (agents || []).find((a) => a.argument_prefix === val) || null;
    }
    return null;
  };

  // strongest_agent / weakest_agent can be {pro: "A", con: "B"} or just "A"
  const strongestVal = panelDynamics.strongest_agent;
  const weakestVal = panelDynamics.weakest_agent;

  // Build per-side agent highlights when the value is a dict
  const strongestPro = findAgent(typeof strongestVal === 'object' ? strongestVal?.pro : strongestVal);
  const strongestCon = findAgent(typeof strongestVal === 'object' ? strongestVal?.con : strongestVal);
  const weakestPro = findAgent(typeof weakestVal === 'object' ? weakestVal?.pro : weakestVal);
  const weakestCon = findAgent(typeof weakestVal === 'object' ? weakestVal?.con : weakestVal);

  // coordination, coverage, synergy can be strings OR {pro: N, con: N} score dicts
  const coordScores = extractScores(panelDynamics.coordination);
  const coverageScores = extractScores(panelDynamics.coverage);
  const synergyScores = extractScores(panelDynamics.synergy);

  const coordStr = !coordScores ? extractString(panelDynamics.coordination) : null;
  const coverageStr = !coverageScores ? extractString(panelDynamics.coverage) : null;
  const synergyStr = !synergyScores ? extractString(panelDynamics.synergy) : null;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Users size={14} className="text-gray-400" />
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Panel Dynamics
        </h4>
      </div>

      {/* Score bars when data is numeric */}
      {(coordScores || coverageScores || synergyScores) && (
        <div className="space-y-3">
          {coordScores && <ScoreBar label="Coordination" pro={coordScores.pro} con={coordScores.con} />}
          {coverageScores && <ScoreBar label="Coverage" pro={coverageScores.pro} con={coverageScores.con} />}
          {synergyScores && <ScoreBar label="Synergy" pro={synergyScores.pro} con={synergyScores.con} />}
        </div>
      )}

      {/* Text descriptions when data is strings */}
      {(coordStr || coverageStr || synergyStr) && (
        <div className="space-y-3">
          {coordStr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Coordination</div>
              <p className="text-sm text-gray-300">{coordStr}</p>
            </div>
          )}
          {coverageStr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Coverage</div>
              <p className="text-sm text-gray-300">{coverageStr}</p>
            </div>
          )}
          {synergyStr && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Synergy</div>
              <p className="text-sm text-gray-300">{synergyStr}</p>
            </div>
          )}
        </div>
      )}

      {/* Agent highlights */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
        {(strongestPro || strongestCon) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Star size={12} className="text-green-400" />
            <span className="text-xs text-gray-400">Strongest:</span>
            {strongestPro && (
              <span className="text-xs">
                <span className="text-blue-400 font-medium">{strongestPro.argument_prefix}</span>{' '}
                <span className="text-gray-500">{strongestPro.title}</span>
              </span>
            )}
            {strongestCon && (
              <span className="text-xs">
                <span className="text-amber-400 font-medium">{strongestCon.argument_prefix}</span>{' '}
                <span className="text-gray-500">{strongestCon.title}</span>
              </span>
            )}
          </div>
        )}
        {(weakestPro || weakestCon) && (
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-xs text-gray-400">Weakest:</span>
            {weakestPro && (
              <span className="text-xs">
                <span className="text-blue-400 font-medium">{weakestPro.argument_prefix}</span>{' '}
                <span className="text-gray-500">{weakestPro.title}</span>
              </span>
            )}
            {weakestCon && (
              <span className="text-xs">
                <span className="text-amber-400 font-medium">{weakestCon.argument_prefix}</span>{' '}
                <span className="text-gray-500">{weakestCon.title}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
