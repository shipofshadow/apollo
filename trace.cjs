const fs = require('fs');
const content = fs.readFileSync('src/pages/admin/AdminInquiryDetail.tsx', 'utf8');

const regex = /<(\/?)([a-zA-Z0-9_]+)(?:\s+[^>]*?)?(\/?)>/g;
let match;
let depth = 0;
let lineNum = 1;
let lastIndex = 0;

while ((match = regex.exec(content)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    const isSelfClosing = match[3] === '/';

    const substr = content.substring(lastIndex, match.index);
    lineNum += (substr.match(/\n/g) || []).length;
    lastIndex = match.index;

    if (tagName.toLowerCase() === 'div') {
        if (!isClosing && !isSelfClosing) depth++;
        else if (isClosing) depth--;
    }
    
    // Log depth at interesting lines
    if (lineNum === 633) console.log('Start of grid: ', depth);
    if (lineNum === 635) console.log('Start of left col: ', depth);
    if (lineNum === 661) console.log('Start of client block: ', depth);
    if (lineNum === 844) console.log('Start of checklists: ', depth);
    if (lineNum === 902) console.log('Start of right col: ', depth);
    if (lineNum === 1445) console.log('End of grid: ', depth);
}
