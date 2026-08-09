const fs = require('fs');
const raw = fs.readFileSync('src/pages/admin/AdminInquiryDetail.tsx', 'utf8');
const lines = raw.split('\n');

// All 0-indexed
const GRID_OPEN     = 626;  // line 627: <div className="grid...
const LEFT_COL_OPEN = 628;  // line 629: <div className="lg:col-span-8...
// left col content: lines 629..868 (0-indexed), line 869 closes left col
const LEFT_COL_CONTENT_START = 629; // line 630: {/* Inquiry Details...
const LEFT_COL_CLOSE = 868; // line 869: </div> closes left col (the </div> at 4-space indent)

// Right column stuff
const SCHEDULE_OPEN = 872; // line 873: <div bg-[#121212] schedule card
const SCHEDULE_CLOSE = 923; // line 924: </div> closes schedule card
const STATUS_OPEN  = 925; // line 926: {/* Status Workflow */}
const STATUS_CLOSE = 1281; // line 1282: </div> closes status block
const NOTES_OPEN   = 1283; // line 1284: {/* Internal Notes Section */}
const NOTES_CLOSE  = 1346; // line 1347: </div>
const ACTIVITY_OPEN= 1347; // line 1348: {/* Activity Timeline */}
const ACTIVITY_CLOSE = 1402; // line 1403: </div> closes activity block

// Slice blocks (exclusive end to get the content including the closing div)
const clientBlock    = lines.slice(LEFT_COL_CONTENT_START, LEFT_COL_CLOSE + 1).join('\n');
const scheduleBlock  = lines.slice(SCHEDULE_OPEN, SCHEDULE_CLOSE + 1).join('\n');
const statusBlock    = lines.slice(STATUS_OPEN, STATUS_CLOSE + 1).join('\n');
const notesBlock     = lines.slice(NOTES_OPEN, NOTES_CLOSE + 1).join('\n');
const activityBlock  = lines.slice(ACTIVITY_OPEN, ACTIVITY_CLOSE + 1).join('\n');

// Also include the checklist section (lines 811-868 are inside left col content)
// clientBlock already includes checklists (629..868) so that's fine.

// Before grid: lines 0..GRID_OPEN-1
const beforeGrid = lines.slice(0, GRID_OPEN).join('\n');

// After grid: lines starting after the 2 closing divs (right col + grid) at 1403-1405
// line 1404 (0-based 1403): </div>  right col close
// line 1405 (0-based 1404): </div>  grid close
// line 1406 (0-based 1405): blank
// line 1407 (0-based 1406): {/* Action Confirmation Modal */}
const afterGrid = lines.slice(1405).join('\n');

const newGrid = `      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Tabbed Content */}
        <div className="lg:col-span-8 space-y-6">

          {/* Tab Navigation */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-2 flex overflow-x-auto hide-scrollbar shadow-xl">
            {[
              { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
              { id: 'checklists', label: 'Checklists', icon: <ClipboardList className="w-4 h-4" /> },
              { id: 'notes', label: 'Internal Notes', icon: <StickyNote className="w-4 h-4" /> },
              { id: 'activity', label: 'Activity Log', icon: <Activity className="w-4 h-4" />, badge: activityLogs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={\`flex items-center gap-2 px-5 py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap \${
                  activeTab === tab.id
                    ? 'bg-brand-orange text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }\`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={\`ml-1 px-1.5 py-0.5 rounded text-[9px] font-black leading-none \${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}\`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8">
${clientBlock}
            </div>
          )}

          {activeTab === 'checklists' && (
            <div className="space-y-8">
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-8">
${notesBlock}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-8">
${activityBlock}
            </div>
          )}
        </div>

        {/* Right Column: Status Actions & Schedule */}
        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-6 self-start">
${scheduleBlock}
${statusBlock}
        </div>
      </div>`;

const content = beforeGrid + '\n' + newGrid + '\n' + afterGrid;

fs.writeFileSync('src/pages/admin/AdminInquiryDetail.tsx', content, 'utf8');
console.log('Done — single grid, no stray characters.');
