import type { Problem } from './types'

// A debug problem: the starter code sets `total` to 0 once, before the outer loop, and never again, so each
// student's total also holds the totals of everyone before them.
export const studentTotalsProblem: Problem = {
  id: 'studentTotals',
  title: {
    uz: "O'quvchilar ballari",
    en: 'Student Totals',
    ru: 'Баллы учеников',
  },
  topic: 'arrays',
  difficulty: 'medium',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan 3 ta o'quvchining 2 tadan bahosini, jami 6 ta butun sonni, `scores` massiviga o'quvchima-o'quvchi o'qiydi. Har bir o'quvchi uchun u o'sha o'quvchining ikkala bahosi yig'indisini alohida qatorga chiqarishi kerak, birinchi o'quvchidan boshlab.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: ba'zi qiymatlar uchun u noto'g'ri javob chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymatlar `1 2 3 4 5 6` bo'lsa, natija:\n`3`\n`7`\n`11`\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: "The program reads 2 scores for each of 3 students, 6 whole numbers in all, into the array `scores` with `scanf`, student by student. For each student it must print the sum of that student's two scores on its own line, starting with the first student.\n\nThe program in the editor is meant to do this, but it has a mistake: for some inputs it prints the wrong answer. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `1 2 3 4 5 6`, the output must be:\n`3`\n`7`\n`11`\n\nCheck runs your program with several different inputs.",
    ru: 'Программа считывает с помощью `scanf` по 2 оценки каждого из 3 учеников, всего 6 целых чисел, в массив `scores`, ученик за учеником. Для каждого ученика она должна вывести сумму двух его оценок на отдельной строке, начиная с первого ученика.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: для некоторых вводов она выводит неправильный ответ. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `1 2 3 4 5 6`, вывод должен быть:\n`3`\n`7`\n`11`\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int scores[3][2];',
    '    int i, j;',
    '    int total = 0;',
    '',
    '    for (i = 0; i < 3; i++) {',
    '        for (j = 0; j < 2; j++) {',
    '            scanf("%d", &scores[i][j]);',
    '        }',
    '    }',
    '',
    '    for (i = 0; i < 3; i++) {',
    '        for (j = 0; j < 2; j++) {',
    '            total += scores[i][j];',
    '        }',
    '        printf("%d\\n", total);',
    '    }',
    '',
    '    return 0;',
    '}',
  ],
  // The last case has zeros for the first two students, so nothing carries over and the mistake doesn't show.
  testCases: [
    { input: '1 2 3 4 5 6', expectedOutput: '3\n7\n11\n' },
    { input: '10 20 5 5 0 0', expectedOutput: '30\n10\n0\n' },
    { input: '0 0 0 0 7 8', expectedOutput: '0\n0\n15\n' },
  ],
}
