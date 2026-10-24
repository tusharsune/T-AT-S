const assert = require('assert');

// Fix #15: Import compiled SDK module from dist directly
const { WakeWordDetector } = require('../dist/audio/wakeWordDetector');


console.log('==================================================');
console.log('Testing T@S JavaScript Web Audio Engine & Wake Word');
console.log('==================================================');

const detector = new WakeWordDetector('Hey T@S');

// Test 1: Exact wake word match
let res = detector.check('Hey T@S');
assert.strictEqual(res.detected, true, 'Should detect "Hey T@S"');
console.log('[PASS] Detected exact wake word "Hey T@S"');

// Test 2: Spoken command in same breath
res = detector.check('hey tats schedule an interview tomorrow at 3pm');
assert.strictEqual(res.detected, true, 'Should detect "hey tats"');
assert.strictEqual(res.command, 'schedule an interview tomorrow at 3pm');
console.log('[PASS] Detected wake word with inline command: "' + res.command + '"');

// Test 3: Variation "t at s"
res = detector.check('ok t at s show me my balance');
assert.strictEqual(res.detected, true, 'Should detect "ok t at s"');
assert.strictEqual(res.command, 'show me my balance');
console.log('[PASS] Detected variation "ok t at s": "' + res.command + '"');

// Test 4: Custom wake word
detector.setWakeWord('Hey Jarvis');
res = detector.check('hey jarvis turn off all lights');
assert.strictEqual(res.detected, true, 'Should detect custom wake word "Hey Jarvis"');
assert.strictEqual(res.command, 'turn off all lights');
console.log('[PASS] Detected custom wake word "Hey Jarvis": "' + res.command + '"');

// Test 5: Negative case (no wake word)
res = detector.check('just chatting with someone else about the weather');
assert.strictEqual(res.detected, false, 'Should NOT detect wake word in ordinary conversation');
console.log('[PASS] Non-wake phrase rejected as expected');

console.log('==================================================');
console.log('ALL JAVASCRIPT SDK WAKE WORD & AUDIO TESTS PASSED!');
console.log('==================================================');

