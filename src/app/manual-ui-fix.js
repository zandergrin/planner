// Manual UI Fix Script
// Run this to complete the UI integration
// This patches /components/SitemapEditor.tsx

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'SitemapEditor.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Replace save status text with SaveStatusIndicator component
content = content.replace(
  /\{hasUnsavedChanges && !isViewOnly && \(\s*<span className="text-xs text-amber-600">Unsaved changes<\/span>\s*\)\}/,
  `{!isViewOnly && (
              <SaveStatusIndicator 
                isSaving={isSaving}
                hasUnsavedChanges={hasUnsavedChanges}
                lastSavedAt={lastSavedAt}
              />
            )}`
);

// Fix 2: Replace version button to remove blocking save
const oldVersionButton = /<Button variant="outline" size="sm" onClick=\{async \(\) => \{\s*if \(!isViewOnly\) \{\s*await handleSave\(\);\s*\}\s*setShowVersionManager\(true\);\s*\}\}>\s*<GitBranch className="h-4 w-4 mr-2" \/>\s*Versions\s*<\/Button>/s;

const newVersionButton = `<Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setIsLoadingVersions(true);
                setTimeout(() => {
                  setShowVersionManager(true);
                  setIsLoadingVersions(false);
                }, 100);
              }}
              disabled={isLoadingVersions}
            >
              {isLoadingVersions ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4 mr-2" />
              )}
              Versions
            </Button>`;

content = content.replace(oldVersionButton, newVersionButton);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ UI fixes applied successfully!');
