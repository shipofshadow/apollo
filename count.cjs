const fs = require('fs');
let lines = fs.readFileSync('src/pages/admin/AdminInquiryDetail.tsx', 'utf8').split('\n');
const clientBlock = lines.slice(629, 810).join('\n');
const openMatches = clientBlock.match(/<div[^>]*[^\/]\s*>/g) || [];
const selfCloseMatches = clientBlock.match(/<div[^>]*\/\s*>/g) || [];
const closeMatches = clientBlock.match(/<\/div>/g) || [];
console.log(`Open: ${openMatches.length}, Self-Close: ${selfCloseMatches.length}, Close: ${closeMatches.length}`);
