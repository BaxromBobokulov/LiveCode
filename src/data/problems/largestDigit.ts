import type { Problem } from './types'

// A debug problem: the starter code has `largest == digit;` where `largest = digit;` was meant, so the line
// compares the two, throws the result away and `largest` stays 0. The usual form of this mix-up, `=` in a
// condition like `while (i = 5)`, can't be a debug problem: the parser rejects it (unsupported.assignInExpr).
export const largestDigitProblem: Problem = {
  id: 'largestDigit',
  title: {
    uz: 'Eng katta raqam',
    en: 'Largest Digit',
    ru: 'Наибольшая цифра',
  },
  topic: 'while',
  difficulty: 'medium',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan 0 dan kichik bo'lmagan bitta butun son `n` ni o'qiydi va `while` sikli yordamida uning raqamlarini birma-bir ko'rib chiqib, eng katta raqamni chiqarishi kerak.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: u noto'g'ri javob chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymat `5839` bo'lsa, natija `9` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one whole number `n`, 0 or greater, with `scanf` and, using a `while` loop, must go through its digits one by one and print the largest digit.\n\nThe program in the editor is meant to do this, but it has a mistake: it prints the wrong answer. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `5839`, the output must be `9`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно целое число `n`, не меньше 0, и с помощью цикла `while` должна перебрать его цифры одну за другой и вывести наибольшую.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: она выводит неправильный ответ. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `5839`, вывод должен быть `9`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int n;',
    '    int digit;',
    '    int largest = 0;',
    '    scanf("%d", &n);',
    '',
    '    while (n > 0) {',
    '        digit = n % 10;',
    '        if (digit > largest) {',
    '            largest == digit;',
    '        }',
    '        n = n / 10;',
    '    }',
    '    printf("%d\\n", largest);',
    '',
    '    return 0;',
    '}',
  ],
  // 0 is the one case the mistake doesn't touch, since `largest` already starts there.
  testCases: [
    { input: '5839', expectedOutput: '9\n' },
    { input: '7', expectedOutput: '7\n' },
    { input: '1204', expectedOutput: '4\n' },
    { input: '0', expectedOutput: '0\n' },
  ],
}
