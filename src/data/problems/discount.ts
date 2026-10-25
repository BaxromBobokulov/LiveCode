import type { Problem } from './types'

// A debug problem: the starter code has a `;` right after `if (price > 100)`, which ends the if there,
// so the block under it is not part of the if and runs for every price.
export const discountProblem: Problem = {
  id: 'discount',
  title: {
    uz: 'Chegirma',
    en: 'Discount',
    ru: 'Скидка',
  },
  topic: 'conditions',
  difficulty: 'easy',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan mahsulot narxini, butun son `price` ni o'qiydi. Narx 100 dan katta bo'lsa, do'kon 10 chegirma beradi; aks holda narx o'zgarmaydi. Dastur to'lanadigan narxni chiqarishi kerak.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: ba'zi narxlar uchun u noto'g'ri javob chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymat `150` bo'lsa, natija `140` bo'lishi kerak, `80` bo'lsa esa — `80`.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads the price of an item, a whole number `price`, with `scanf`. If the price is more than 100, the shop gives a discount of 10; otherwise the price stays the same. The program must print the price to pay.\n\nThe program in the editor is meant to do this, but it has a mistake: for some prices it prints the wrong answer. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `150`, the output must be `140`, and if the input is `80`, it must be `80`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` цену товара — целое число `price`. Если цена больше 100, магазин даёт скидку 10, иначе цена не меняется. Программа должна вывести цену к оплате.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: для некоторых цен она выводит неправильный ответ. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `150`, вывод должен быть `140`, а если ввод `80` — `80`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int price;',
    '    scanf("%d", &price);',
    '',
    '    if (price > 100);',
    '    {',
    '        price = price - 10;',
    '    }',
    '    printf("%d\\n", price);',
    '',
    '    return 0;',
    '}',
  ],
  // One price that gets the discount and two that don't, 100 itself included: the mistake only shows
  // on prices that shouldn't change, so Check can't pass with every price discounted.
  testCases: [
    { input: '150', expectedOutput: '140\n' },
    { input: '80', expectedOutput: '80\n' },
    { input: '100', expectedOutput: '100\n' },
  ],
}
