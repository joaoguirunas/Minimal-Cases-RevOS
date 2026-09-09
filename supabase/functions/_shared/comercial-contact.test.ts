import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldHandoffToHuman } from './comercial-contact.ts';
Deno.test('só comercial, só na primeira mensagem enviada', () => {
  assertEquals(shouldHandoffToHuman({ senderUserType: 'comercial', priorHumanSentByUser: 0 }), true);
  assertEquals(shouldHandoffToHuman({ senderUserType: 'comercial', priorHumanSentByUser: 1 }), false);
  assertEquals(shouldHandoffToHuman({ senderUserType: 'admin', priorHumanSentByUser: 0 }), false);
  assertEquals(shouldHandoffToHuman({ senderUserType: null, priorHumanSentByUser: 0 }), false);
});
