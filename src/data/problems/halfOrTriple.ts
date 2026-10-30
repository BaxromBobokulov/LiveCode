import type { Problem } from './types'

// A debug problem: the starter code has two separate `if`s where the second should be `else`. An even n is
// halved by the first, and when the half is odd the second `if` changes it again.
export const halfOrTripleProblem: Problem = {
  id: 'halfOrTriple',
  title: {
    uz: 'Yarim yoki uch baravar',
    en: 'Half or Triple',
    ru: 'Половина или утроение',
  },
  topic: 'conditions',
  difficulty: 'medium',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan bitta musbat butun son `n` ni o'qiydi. Agar `n` juft bo'lsa, natija `n / 2` bo'ladi; agar `n` toq bo'lsa, natija `n * 3 + 1` bo'ladi. Dastur natijani chiqarishi kerak.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: ba'zi qiymatlar uchun u noto'g'ri javob chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymat `6` bo'lsa, natija `3` bo'lishi kerak, `5` bo'lsa esa — `16`.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one positive whole number `n` with `scanf`. If `n` is even, the result is `n / 2`; if `n` is odd, the result is `n * 3 + 1`. The program must print the result.\n\nThe program in the editor is meant to do this, but it has a mistake: for some inputs it prints the wrong answer. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `6`, the output must be `3`, and if the input is `5`, it must be `16`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно положительное целое число `n`. Если `n` чётное, результат равен `n / 2`; если `n` нечётное, результат равен `n * 3 + 1`. Программа должна вывести результат.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: для некоторых вводов она выводит неправильный ответ. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `6`, вывод должен быть `3`, а если ввод `5` — `16`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int n;',
    '    scanf("%d", &n);',
    '',
    '    if (n % 2 == 0) {',
    '        n = n / 2;',
    '    }',
    '    if (n % 2 != 0) {',
    '        n = n * 3 + 1;',
    '    }',
    '    printf("%d\\n", n);',
    '',
    '    return 0;',
    '}',
  ],
  // 6 and 10 have an odd half, so the second `if` runs too. 5 is odd and 4 has an even half: the mistake
  // doesn't touch those two, so the student sees which inputs break it.
  testCases: [
    { input: '6', expectedOutput: '3\n' },
    { input: '5', expectedOutput: '16\n' },
    { input: '4', expectedOutput: '2\n' },
    { input: '10', expectedOutput: '5\n' },
  ],
}
