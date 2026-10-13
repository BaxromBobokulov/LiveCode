import { describe, expect, it } from 'vitest'
import { examples } from '../data/examples'
import { translations } from '../i18n/translations'
import { formatPhrase } from '../i18n/formatPhrase'
import { CodeError, UnsupportedConstructError, isMissingInput } from './errors'
import { runUserCode } from './interpreter'
import type { Step } from './types'

function stepsOf(source: string): Step[] {
  const result = runUserCode(source)
  if ('error' in result) throw new Error(`Unexpected error on line ${result.error.line}: ${result.error.message}`)
  return result.steps
}

const lines = (...code: string[]) => code.join('\n')

/** A step's explanation as the Playground shows it in English. */
const english = (step: Step) => step.explanation.map((p) => formatPhrase(translations.en, p)).join(' ')

describe('runUserCode', () => {
  it('traces a simple assignment program', () => {
    const steps = stepsOf(
      lines(
        '#include <stdio.h>',
        'int main() {',
        '    int a = 2;',
        '    int b;',
        '    b = a * 3;',
        '    printf("b = %d\\n", b);',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.map((s) => s.line)).toEqual([3, 4, 5, 6, 7])
    expect(steps[0]).toMatchObject({ scope: 'main()', changed: ['a'], variables: [{ name: 'a', value: '2' }] })
    expect(english(steps[0])).toBe('Create a and set it to 2.')
    expect(steps[1].variables).toContainEqual({ name: 'b', value: '?' })
    expect(english(steps[2])).toBe('Set b to a * 3: 2 * 3 = 6.')
    expect(steps[2].changed).toEqual(['b'])
    expect(steps[3].output).toBe('b = 6\n')
    expect(english(steps[4])).toBe('Return 0 from main. The program finished successfully.')
  })

  it('traces a for loop over an array', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int arr[3] = {4, 8, 15};',
        '    int sum = 0;',
        '    for (int i = 0; i < 3; i++) {',
        '        sum = sum + arr[i];',
        '    }',
        '    printf("%d\\n", sum);',
        '    return 0;',
        '}',
      ),
    )

    const checks = steps.filter((s) => s.line === 4)
    expect(checks).toHaveLength(4)
    expect(english(checks[0])).toBe('Start the loop: create i and set it to 0. Check i < 3: 0 < 3 is true, so run the loop body.')
    expect(english(checks[1])).toBe('Increase i to 1. Check i < 3: 1 < 3 is true, so run the loop body again.')
    expect(english(checks[3])).toBe('Increase i to 3. Check i < 3: 3 < 3 is false, so the loop ends.')
    expect(checks[3].loop).toBeNull()

    const bodySteps = steps.filter((s) => s.line === 5)
    expect(bodySteps.map((s) => s.loop)).toEqual([
      { line: 4, iteration: 1, total: 3 },
      { line: 4, iteration: 2, total: 3 },
      { line: 4, iteration: 3, total: 3 },
    ])
    expect(bodySteps[1].array).toEqual({ name: 'arr', values: [4, 8, 15], activeIndex: 1 })
    expect(english(bodySteps[1])).toBe('Set sum to sum + arr[i]: 4 + 8 = 12.')
    expect(steps.at(-2)?.output).toBe('27\n')
  })

  it('takes the matching if / else branch', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int x = 3;',
        '    if (x > 5) {',
        '        printf("big\\n");',
        '    } else if (x > 1) {',
        '        printf("medium\\n");',
        '    } else {',
        '        printf("small\\n");',
        '    }',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.map((s) => s.line)).toEqual([2, 3, 5, 6, 10])
    expect(english(steps[1])).toBe('Check if x > 5: 3 > 5 is false, so check the next condition.')
    expect(english(steps[2])).toBe('Check else if x > 1: 3 > 1 is true, so run this else if block.')
    expect(steps.at(-1)?.output).toBe('medium\n')
  })

  it('steps into a function call and back', () => {
    const steps = stepsOf(
      lines(
        'int add(int a, int b) {',
        '    return a + b;',
        '}',
        '',
        'int main() {',
        '    int s = add(2, 3);',
        '    printf("%d\\n", s);',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.map((s) => [s.line, s.scope])).toEqual([
      [1, 'add()'],
      [2, 'add()'],
      [6, 'main()'],
      [7, 'main()'],
      [8, 'main()'],
    ])
    expect(english(steps[0])).toBe('Call add(2, 3). Inside add, a = 2 and b = 3.')
    expect(steps[0].variables).toEqual([
      { name: 'a', value: '2' },
      { name: 'b', value: '3' },
    ])
    expect(english(steps[1])).toBe('Leave add and go back to main, returning a + b: 2 + 3 = 5.')
    expect(english(steps[2])).toBe('Create s and set it to add(2, 3) (5).')
    expect(steps[3].output).toBe('5\n')
  })

  it('traces reads and writes on a 2D array', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};',
        '    int x = grid[1][2];',
        '    grid[0][0] = grid[0][0] + 4;',
        '    grid[1][0]++;',
        '    return 0;',
        '}',
      ),
    )

    expect(english(steps[0])).toBe('Declare an int 2D array grid with 2 rows and 3 columns: [[1, 2, 3], [4, 5, 6]].')
    expect(steps[0].variables).toEqual([{ name: 'grid', value: '[[1, 2, 3], [4, 5, 6]]' }])
    expect(steps[0].array).toEqual({ name: 'grid', values: [[1, 2, 3], [4, 5, 6]], activeIndex: null })

    expect(english(steps[1])).toBe('Read grid[1][2] (value 6). Create x and set it to grid[1][2] (6).')
    expect(steps[1].array?.activeIndex).toEqual({ row: 1, col: 2 })

    expect(english(steps[2])).toBe('Read grid[0][0] (value 1). Set grid[0][0] to grid[0][0] + 4: 1 + 4 = 5.')
    expect(steps[2].changed).toEqual(['grid'])
    expect(steps[2].array).toEqual({ name: 'grid', values: [[5, 2, 3], [4, 5, 6]], activeIndex: { row: 0, col: 0 } })

    expect(english(steps[3])).toBe('Increase grid[1][0] by 1. grid[1][0] is now 5.')
    expect(steps[3].array?.activeIndex).toEqual({ row: 1, col: 0 })
  })

  it('passes a 2D array to a function by reference', () => {
    const steps = stepsOf(
      lines(
        'void fill(int g[][2]) {',
        '    g[1][1] = 9;',
        '}',
        'int main() {',
        '    int grid[2][2];',
        '    fill(grid);',
        '    printf("%d\\n", grid[1][1]);',
        '    return 0;',
        '}',
      ),
    )
    expect(steps.at(-1)?.output).toBe('9\n')
  })

  it('reports an out-of-range 2D index as a code error', () => {
    const result = runUserCode(lines('int main() {', '    int g[2][2] = {{1, 2}, {3, 4}};', '    g[0][2] = 1;', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(CodeError)
    expect('error' in result && result.error.text).toEqual({
      key: 'codeError.colOutside',
      values: { name: 'g', row: 0, col: 2, cols: 2, last: 1 },
    })
  })

  it('reports a 3D array as not supported', () => {
    const result = runUserCode(lines('int main() {', '    int cube[2][2][2];', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(UnsupportedConstructError)
    expect('error' in result && result.error).toMatchObject({ line: 2, construct: { key: 'construct.array3d' } })
  })

  it.each(examples.map((example) => [example.id, example] as const))(
    'agrees with the hand-authored %s example',
    (_, example) => {
      const steps = stepsOf(example.code.join('\n'))
      expect(steps.map((s) => s.line)).toEqual(example.steps.map((s) => s.line))
      expect(steps.at(-1)?.output).toBe(example.steps.at(-1)?.output)

      // Bubble sort highlights both cells of a compare or swap, which only the hand-authored trace does.
      if (example.steps.some((s) => s.array && 'secondIndex' in s.array)) return
      expect(steps.map((s) => s.array?.activeIndex ?? null)).toEqual(example.steps.map((s) => s.array?.activeIndex ?? null))
    },
  )

  it('explains the hand-authored examples in every language', () => {
    expect(english(examples[0].steps[3])).toBe('Start the loop: set i to 0. 0 < 5 is true, so run the loop body.')
    expect(english(examples[0].steps[4])).toBe('Add arr[0] (4) to sum. sum is now 4.')

    const userCode = lines(
      'int add(int a, int b) {',
      '    return a + b;',
      '}',
      'int main() {',
      '    float g[1][2] = {{1, 2}};',
      '    char t[] = "ab", u[2];',
      '    int s = 0;',
      '    for (int i = 0; i < 2; i++) {',
      '        if (i > 0) { s = add(s, i); } else if (i < 0) { s--; } else { s++; }',
      '    }',
      '    printf("%d\\n", s);',
      '    return 0;',
      '}',
    )
    const allSteps = [...examples.flatMap((e) => e.steps), ...stepsOf(userCode)]
    for (const strings of Object.values(translations)) {
      for (const step of allSteps) {
        for (const phrase of step.explanation) {
          // Every placeholder got a value: nothing left like "{name}" or "undefined".
          expect(formatPhrase(strings, phrase)).not.toMatch(/\{\w+\}|undefined/)
        }
      }
    }
  })

  it('highlights the element a loop body is about to use on the loop check', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int arr[3] = {4, 8, 15};',
        '    int i = 0;',
        '    while (i < 3) {',
        '        arr[i] = arr[i] * 2;',
        '        i++;',
        '    }',
        '    return 0;',
        '}',
      ),
    )

    const checks = steps.filter((s) => s.line === 4)
    expect(checks.map((s) => s.array?.activeIndex)).toEqual([0, 1, 2, null])
    // The check shows the array as it was before the body changed it.
    expect(checks[1].array?.values).toEqual([8, 8, 15])
  })

  it('reports a pointer as not supported, with its line', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1;', '    int *p = &x;', '    return 0;', '}'))

    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toBeInstanceOf(UnsupportedConstructError)
    expect(result.error).toMatchObject({ line: 3, construct: { key: 'construct.pointer' } })
  })

  it('reports mistakes in the program as code errors instead of throwing', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1 / 0;', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(CodeError)
    expect('error' in result && result.error.line).toBe(2)
    expect('error' in result && result.error.text.key).toBe('codeError.divisionByZero')
  })

  it('prints a puts line followed by a newline, with no placeholders', () => {
    const steps = stepsOf(lines('int main() {', '    puts("100% done");', '    puts("hello");', '    return 0;', '}'))

    expect(steps[1].output).toBe('100% done\nhello\n')
    expect(english(steps[1])).toBe('Print "hello" and move to a new line.')
  })

  it('reads scanf values from the input in the order the program runs them', () => {
    const source = lines(
      'int main() {',
      '    int n;',
      '    scanf("%d", &n);',
      '    int sum = 0;',
      '    for (int i = 0; i < n; i++) {',
      '        sum += i;',
      '    }',
      '    float x;',
      '    scanf("%f", &x);',
      '    printf("%d %f\\n", sum, x);',
      '    return 0;',
      '}',
    )
    const result = runUserCode(source, ' 3   2.5 ')
    if ('error' in result) throw new Error(result.error.message)
    const reads = result.steps.filter((s) => s.line === 3 || s.line === 9)

    expect(english(reads[0])).toBe('Read 3 from the input and store it in n.')
    expect(reads[0].changed).toEqual(['n'])
    expect(reads[1].variables).toContainEqual({ name: 'x', value: '2.5' })
    expect(result.steps.at(-1)?.output).toBe('3 2.500000\n')
  })

  it('reports missing scanf input as a code error', () => {
    const source = lines('int main() {', '    int a;', '    int b;', '    scanf("%d", &a);', '    scanf("%d", &b);', '    return 0;', '}')

    for (const input of ['', '7']) {
      const result = runUserCode(source, input)
      expect('error' in result && result.error).toBeInstanceOf(CodeError)
      expect('error' in result && result.error.text.key).toBe('codeError.scanfNoInput')
    }
    const result = runUserCode(source)
    expect('error' in result && result.error.line).toBe(4)
  })

  it('reads several scanf values in one call, one step per value', () => {
    const source = lines('int main() {', '    int a;', '    float b;', '    scanf("%d %f", &a, &b);', '    return 0;', '}')
    const result = runUserCode(source, '7 1.5')
    if ('error' in result) throw new Error(result.error.message)
    const reads = result.steps.filter((s) => s.line === 4)

    expect(reads.map(english)).toEqual([
      'Read 7 from the input and store it in a.',
      'Read 1.5 from the input and store it in b.',
    ])
    expect(reads.map((s) => s.changed)).toEqual([['a'], ['b']])
  })

  it('tells missing Input values apart from other scanf errors', () => {
    const errorFor = (source: string, input: string) => {
      const result = runUserCode(source, input)
      if (!('error' in result)) throw new Error('Expected an error')
      return result.error
    }
    const one = lines('int main() {', '    int a;', '    scanf("%d", &a);', '    return 0;', '}')
    const two = lines('int main() {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    return 0;', '}')

    expect(isMissingInput(errorFor(one, ''))).toBe(true)
    expect(isMissingInput(errorFor(two, '1'))).toBe(true)
    expect(isMissingInput(errorFor(one, 'x'))).toBe(false)
    expect(isMissingInput(errorFor(two, '1 x'))).toBe(false)
  })

  it('says which value of a scanf call failed', () => {
    const source = lines('int main() {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    return 0;', '}')
    const result = runUserCode(source, '1')

    expect('error' in result && result.error).toBeInstanceOf(CodeError)
    if (!('error' in result)) return
    expect(result.error.line).toBe(3)
    expect(formatPhrase(translations.en, result.error.text)).toMatch(
      /^Value 2 of 2 in this scanf call: Not enough input values/,
    )

    const missingAmpersand = runUserCode(lines('int main() {', '    int a, b;', '    scanf("%d %d", &a, b);', '}'), '1 2')
    expect('error' in missingAmpersand && missingAmpersand.error.text).toMatchObject({
      key: 'codeError.scanfValue',
      values: { position: 2, problem: { key: 'codeError.scanfAmpersand' } },
    })
  })

  it('stores a string in a char array, followed by \\0', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    char name[] = "hi";',
        '    char c = name[0];',
        '    name[1] = c + 1;',
        '    printf("%s %c %d\\n", name, c, c);',
        '    puts(name);',
        '    return 0;',
        '}',
      ),
    )

    expect(steps[0].array).toEqual({ name: 'name', values: [104, 105, 0], activeIndex: null, chars: true })
    expect(steps[0].variables).toContainEqual({ name: 'name', value: '"hi"' })
    expect(english(steps[0])).toBe('Declare char array name with 3 elements and store "hi" in it: 2 characters, then \\0 to mark where the text ends.')
    expect(english(steps[1])).toBe("Create c and set it to name[0] ('h').")
    expect(english(steps[2])).toBe("Set name[1] to c + 1: 'h' + 1 = 'i'.")
    expect(steps[2].array).toMatchObject({ activeIndex: 1, chars: true })
    expect(steps[4].output).toBe('hi h 104\nhi\n')
  })

  it('fills the rest of a bigger char array with \\0', () => {
    const steps = stepsOf(lines('int main() {', '    char word[5] = "ok";', '    char empty[3];', '    return 0;', '}'))

    expect(steps[0].array?.values).toEqual([111, 107, 0, 0, 0])
    expect(english(steps[1])).toBe('Declare a char array empty with room for 3 characters. It holds no text yet (every element is shown as \\0).')
  })

  it('reads a word into a char array with scanf %s', () => {
    const source = lines('int main() {', '    char name[6];', '    int age;', '    scanf("%s %d", name, &age);', '    printf("%s is %d\\n", name, age);', '}')
    const result = runUserCode(source, 'Alice 30')
    if ('error' in result) throw new Error(result.error.message)
    const reads = result.steps.filter((s) => s.line === 4)

    expect(english(reads[0])).toBe('Read the word "Alice" from the input and store it in name: 5 characters, then \\0 to mark where the text ends.')
    expect(reads[0].array).toEqual({ name: 'name', values: [65, 108, 105, 99, 101, 0], activeIndex: null, chars: true })
    expect(result.steps.at(-1)?.output).toBe('Alice is 30\n')

    const tooLong = runUserCode(source, 'Alexander 30')
    expect('error' in tooLong && tooLong.error.text).toMatchObject({
      key: 'codeError.scanfValue',
      values: { position: 1, problem: { key: 'codeError.scanfTooLong', values: { count: 9, room: 5 } } },
    })
  })

  it('reports char mistakes as code errors', () => {
    const errorKey = (body: string, input = '') => {
      const result = runUserCode(lines('int main() {', body, '    return 0;', '}'), input)
      if (!('error' in result)) throw new Error('Expected an error')
      return result.error.text.key
    }

    expect(errorKey('    char s[5] = "hello";')).toBe('codeError.stringTooLong')
    expect(errorKey('    char c = "A";')).toBe('codeError.stringIntoChar')
    expect(errorKey('    int n[3] = "hi";')).toBe('codeError.stringIntoNonChar')
    expect(errorKey("    char c = 'ab';")).toBe('codeError.badChar')
    expect(errorKey('    char s[3] = "hi"; s = "yo";')).toBe('codeError.assignString')
    expect(errorKey('    char s[2] = {\'h\', \'i\'}; printf("%s", s);')).toBe('codeError.noTerminator')
    expect(errorKey('    int x = 1; printf("%s", x);')).toBe('codeError.printfSNotText')
    expect(errorKey('    char s[3]; scanf("%s", &s);')).toBe('codeError.scanfSTarget')
    expect(errorKey('    char c; scanf("%d", &c);', '5')).toBe('codeError.scanfIntoChar')
  })
})
