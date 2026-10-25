import type { Problem } from './types'

// A debug problem: the counting loop starts at `i = 1`, so it never looks at arr[0].
export const countPositivesProblem: Problem = {
  id: 'countPositives',
  title: {
    uz: 'Musbat sonlar soni',
    en: 'Count the Positives',
    ru: 'Количество положительных',
  },
  topic: 'for',
  difficulty: 'medium',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan 5 ta butun sonni `arr` massiviga o'qiydi va ulardan nechtasi musbat (0 dan katta) ekanini `for` sikli bilan sanab, shu sonni chiqarishi kerak. 0 musbat emas.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: ba'zi qiymatlar uchun u noto'g'ri javob chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymatlar `3 -1 4 -1 5` bo'lsa, natija `3` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads 5 whole numbers into the array `arr` with `scanf`, and must count with a `for` loop how many of them are positive (greater than 0), then print that count. 0 is not positive.\n\nThe program in the editor is meant to do this, but it has a mistake: for some inputs it prints the wrong answer. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `3 -1 4 -1 5`, the output must be `3`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` 5 целых чисел в массив `arr` и должна с помощью цикла `for` посчитать, сколько из них положительных (больше 0), и вывести это количество. 0 не положительное число.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: для некоторых вводов она выводит неправильный ответ. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `3 -1 4 -1 5`, вывод должен быть `3`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int arr[5];',
    '    int count = 0;',
    '    int i;',
    '',
    '    for (i = 0; i < 5; i++) {',
    '        scanf("%d", &arr[i]);',
    '    }',
    '',
    '    for (i = 1; i < 5; i++) {',
    '        if (arr[i] > 0) {',
    '            count++;',
    '        }',
    '    }',
    '    printf("%d\\n", count);',
    '',
    '    return 0;',
    '}',
  ],
  // Two inputs that start with a positive number, where skipping arr[0] shows, and one that starts with
  // a negative number, where it doesn't (so the answer isn't simply "count + 1").
  testCases: [
    { input: '3 -1 4 -1 5', expectedOutput: '3\n' },
    { input: '-2 7 0 8 -9', expectedOutput: '2\n' },
    { input: '1 2 3 4 5', expectedOutput: '5\n' },
  ],
}
