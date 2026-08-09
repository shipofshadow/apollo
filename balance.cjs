const fs = require('fs');
const content = fs.readFileSync('src/pages/admin/AdminInquiryDetail.tsx', 'utf8');

const stack = [];
const regex = /<(\/?)([a-zA-Z0-9_]+)(?:\s+[^>]*?)?(\/?)>/g;
let match;
const selfClosingTags = ['br', 'img', 'input', 'hr', 'meta', 'link'];
let lineNum = 1;
let lastIndex = 0;

while ((match = regex.exec(content)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    const isSelfClosing = match[3] === '/' || selfClosingTags.includes(tagName.toLowerCase());

    const substr = content.substring(lastIndex, match.index);
    lineNum += (substr.match(/\n/g) || []).length;
    lastIndex = match.index;

    // We only care about div
    if (tagName.toLowerCase() === 'div') {
        if (!isClosing && !isSelfClosing) {
            stack.push({ tag: tagName, line: lineNum });
        } else if (isClosing) {
            if (stack.length > 0 && stack[stack.length - 1].tag.toLowerCase() === tagName.toLowerCase()) {
                stack.pop();
            } else {
                console.log(`Unmatched closing tag </${tagName}> at line ${lineNum}`);
            }
        }
    }
}

if (stack.length > 0) {
    console.log(`Unmatched opening tags:`);
    stack.forEach(item => {
        console.log(`<${item.tag}> at line ${item.line}`);
    });
} else {
    console.log('All divs are perfectly balanced!');
}
