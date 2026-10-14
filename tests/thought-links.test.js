import {test} from 'node:test';
import assert from 'node:assert/strict';
import {thoughtParts,renderThought} from '../src/thought-links.js';

test('thought links preserve text, queries and balanced URL parentheses without sentence punctuation',()=>{
  const text='Inspired by (https://example.org/leaf_(ginkgo)?view=fan&size=2), then https://si.edu/ginkgo. Quiet edges.';
  const parts=thoughtParts(text);
  assert.equal(parts.map(part=>part.text).join(''),text);
  assert.deepEqual(parts.filter(part=>part.href).map(part=>part.href),[
    'https://example.org/leaf_(ginkgo)?view=fan&size=2','https://si.edu/ginkgo'
  ]);
});

test('HTML and non-web schemes stay plain text, and links use text nodes with a separate tab',()=>{
  const text='<img src=x onerror=alert(1)> javascript:alert(1) data:text/html,x https://si.edu/ginkgo';
  const doc={
    createTextNode:text=>({type:'text',text}),
    createElement:tag=>({tag})
  };
  const element={ownerDocument:doc,replaceChildren(...nodes){this.nodes=nodes;}};
  renderThought(element,text);
  const links=element.nodes.filter(node=>node.tag);
  assert.equal(links.length,1);assert.equal(links[0].tag,'a');
  assert.equal(links[0].href,'https://si.edu/ginkgo');
  assert.equal(links[0].target,'_blank');assert.equal(links[0].rel,'noopener noreferrer');
  assert.equal(element.nodes[0].text,'<img src=x onerror=alert(1)> javascript:alert(1) data:text/html,x ');
  renderThought(element,'A quiet leaf.');
  assert.deepEqual(element.nodes,[{type:'text',text:'A quiet leaf.'}]);
});
