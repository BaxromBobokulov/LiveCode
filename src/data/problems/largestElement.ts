import type { Problem } from './types'

// A debug problem: the search loop runs while `i <= 5`, so its last round reads arr[5], one past the end.
// The interpreter stops there with codeError.indexOutside (real C would read whatever is in memory).
export const largestElementProblem: Problem = {
  id: 'largestElement',
  title: {
    uz: 'Eng katta element',
    en: 'Largest Element',
    ru: 'Наибольший элемент',
  },
  topic: 'arrays',
  difficulty: 'medium',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan 5 ta butun sonni `arr` massiviga o'qiydi va ularning eng kattasini chiqarishi kerak.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor. Xatoni toping va tuzating. Ishga tushirishni bosing va dastur nima qilishini kuzating.\n\nMasalan, kiritilgan qiymatlar `4 9 2 7 5` bo'lsa, natija `9` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads 5 whole numbers into the array `arr` with `scanf`, and must print the largest of them.\n\nThe program in the editor is meant to do this, but it has a mistake. Find the mistake and fix it. Press Run and watch what the program does.\n\nFor example, if the input is `4 9 2 7 5`, the output must be `9`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` 5 целых чисел в массив `arr` и должна вывести наибольшее из них.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка. Найдите ошибку и исправьте её. Нажмите «Запустить» и посмотрите, что делает программа.\n\nНапример, если ввод `4 9 2 7 5`, вывод должен быть `9`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int arr[5];',
    '    int i;',
    '',
    '    for (i = 0; i < 5; i++) {',
    '        scanf("%d", &arr[i]);',
    '    }',
    '',
    '    int max = arr[0];',
    '    for (i = 1; i <= 5; i++) {',
    '        if (arr[i] > max) {',
    '            max = arr[i];',
    '        }',
    '    }',
    '    printf("%d\\n", max);',
    '',
    '    return 0;',
    '}',
  ],
  // The largest in the middle, all negative (so starting from max = 0 would be wrong), and the largest first.
  testCases: [
    { input: '4 9 2 7 5', expectedOutput: '9\n' },
    { input: '-3 -8 -1 -6 -2', expectedOutput: '-1\n' },
    { input: '10 2 3 4 1', expectedOutput: '10\n' },
  ],
}
