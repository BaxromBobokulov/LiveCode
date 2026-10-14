import { describe, expect, it, vi } from 'vitest'
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

  it('reports a pointer feature outside the subset as not supported, with its line', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1;', '    int **p;', '    return 0;', '}'))

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

  it('fills an array with rand() after srand(), the same numbers for the same seed', () => {
    const source = lines(
      '#include <stdio.h>',
      '#include <stdlib.h>',
      'int main() {',
      '    int arr[5];',
      '    srand(1);',
      '    for (int i = 0; i < 5; i++) {',
      '        arr[i] = rand() % 100;',
      '    }',
      '    return 0;',
      '}',
    )
    const steps = stepsOf(source)

    // C's own sample rand() gives 16838 first for seed 1.
    expect(english(steps[1])).toBe(
      'Seed the random numbers with 1. The same seed always gives the same rand() numbers, so this program gets the same values on every Run.',
    )
    const writes = steps.filter((s) => s.line === 7)
    expect(english(writes[0])).toBe(
      'rand() gives the next random number: 16838 (always between 0 and 32767). Set arr[0] to rand() % 100: 16838 % 100 = 38.',
    )
    const filled = steps.at(-1)!.array!.values as number[]
    expect(filled[0]).toBe(38)
    expect(filled.every((v) => v >= 0 && v < 100)).toBe(true)

    // A fixed seed gives the very same trace on every Run, like a real C program.
    expect(stepsOf(source)).toEqual(steps)
  })

  it('starts from seed 1 when there is no srand(), like real C', () => {
    const source = lines('int main() {', '    int a = rand();', '    int b = rand();', '    return 0;', '}')
    const values = (steps: Step[]) => steps[1].variables.map((v) => v.value)
    // The same as after srand(1): every Run gives these same numbers.
    expect(values(stepsOf(source))).toEqual(['16838', '5758'])
    expect(values(stepsOf(source))).toEqual(['16838', '5758'])
  })

  it('seeds with srand(time(NULL)), so a Run in a later second gets new numbers', () => {
    const source = lines(
      '#include <stdlib.h>',
      '#include <time.h>',
      'int main() {',
      '    srand(time(NULL));',
      '    int a = rand();',
      '    return 0;',
      '}',
    )
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_700_000_000_500) // 1700000000 seconds and a half since 1970
      const first = stepsOf(source)
      expect(english(first[0])).toBe(
        'time(NULL) gives the current time: 1700000000 seconds since 1 January 1970. ' +
          'Seed the random numbers with time(NULL) (1700000000). The time changes every second, so each Run gets different rand() numbers.',
      )
      // Within the same second the seed, and so the whole trace, is the same, as in real C.
      vi.setSystemTime(1_700_000_000_900)
      expect(stepsOf(source)).toEqual(first)

      vi.setSystemTime(1_700_000_001_000)
      const later = stepsOf(source)
      expect(later[1].variables).not.toEqual(first[1].variables)
    } finally {
      vi.useRealTimers()
    }
  })

  it('checks how rand and srand are called', () => {
    const error = (body: string) => {
      const result = runUserCode(lines('int main() {', body, '    return 0;', '}'))
      if (!('error' in result)) throw new Error('Expected an error')
      return result.error
    }

    expect(error('    int x = rand(5);').text.key).toBe('codeError.argCount')
    expect(error('    srand();').text.key).toBe('codeError.argCount')
    expect(error('    int x = srand(1);').text.key).toBe('codeError.voidValue')
    // time() only takes NULL: time(&t) would need a pointer.
    expect(error('    int t = 0; srand(time(t));').text).toEqual({ key: 'unsupported.timeArg', values: { arg: 't' } })
    expect(error('    srand(time());').text.key).toBe('codeError.argCount')
    // The rest of <stdlib.h> is still not supported.
    expect(error('    int n = atoi(5);').text).toEqual({ key: 'unsupported.libraryFunction', values: { name: 'atoi' } })
    expect(runUserCode('#include <string.h>\nint main() { return 0; }')).toMatchObject({
      error: { text: { key: 'unsupported.include' } },
    })
  })

  it('leaves a loop early with break', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    for (int i = 0; i < 10; i++) {',
        '        if (i == 3) {',
        '            break;',
        '        }',
        '        printf("%d ", i);',
        '    }',
        '    printf("done");',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.at(-1)?.output).toBe('0 1 2 done')
    const breakStep = steps.find((s) => s.line === 4)!
    expect(english(breakStep)).toBe(
      'break: leave the loop right away. The rest of the loop is skipped and the program goes on after it.',
    )
    // No final loop check after break: the next step is the line after the loop.
    expect(steps[steps.indexOf(breakStep) + 1].line).toBe(8)
    // The loop total counts the iterations that actually ran, not the 10 its condition allows.
    expect(breakStep.loop).toEqual({ line: 2, iteration: 4, total: 4 })
    expect(steps.filter((s) => s.loop).every((s) => s.loop!.total === 4)).toBe(true)
    expect(steps[steps.indexOf(breakStep) + 1].loop).toBeNull()
  })

  it('skips the rest of an iteration with continue', () => {
    const forSteps = stepsOf(
      lines(
        'int main() {',
        '    for (int i = 0; i < 5; i++) {',
        '        if (i % 2 == 1) continue;',
        '        printf("%d ", i);',
        '    }',
        '    return 0;',
        '}',
      ),
    )
    expect(forSteps.at(-1)?.output).toBe('0 2 4 ')
    const continueStep = forSteps.find((s) => s.line === 3 && s.explanation[0].key === 'explain.continueFor')!
    // continue in a for loop: the update (i++) runs next, as part of the loop check.
    const next = forSteps[forSteps.indexOf(continueStep) + 1]
    expect(next.line).toBe(2)
    expect(english(next)).toBe('Increase i to 2. Check i < 5: 2 < 5 is true, so run the loop body again.')
    expect(forSteps.filter((s) => s.loop).every((s) => s.loop!.total === 5)).toBe(true)

    // continue in a while loop goes straight back to the condition.
    const whileSteps = stepsOf(
      lines(
        'int main() {',
        '    int i = 0;',
        '    while (i < 4) {',
        '        i++;',
        '        if (i == 2) continue;',
        '        printf("%d ", i);',
        '    }',
        '    return 0;',
        '}',
      ),
    )
    expect(whileSteps.at(-1)?.output).toBe('1 3 4 ')
    const whileContinue = whileSteps.find((s) => s.explanation[0]?.key === 'explain.continueWhile')!
    expect(english(whileContinue)).toBe(
      'continue: skip the rest of this iteration and go back to check the loop condition again.',
    )
    expect(whileSteps[whileSteps.indexOf(whileContinue) + 1].line).toBe(3)
  })

  it('makes break and continue affect only the innermost loop', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    for (int i = 0; i < 3; i++) {',
        '        for (int j = 0; j < 3; j++) {',
        '            if (j == 1) continue;',
        '            if (j > i) break;',
        '            printf("%d%d ", i, j);',
        '        }',
        '    }',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.at(-1)?.output).toBe('00 10 20 22 ')
    // The outer loop still runs all 3 times.
    expect(steps.filter((s) => s.loop?.line === 2).every((s) => s.loop!.total === 3)).toBe(true)
    // Each inner run counts its own iterations: i = 0 and i = 1 break at j = 2, i = 2 runs j = 0..2 to the end.
    const breakSteps = steps.filter((s) => s.line === 5 && s.explanation[0].key === 'explain.break')
    expect(breakSteps.map((s) => s.loop)).toEqual([
      { line: 3, iteration: 3, total: 3 },
      { line: 3, iteration: 3, total: 3 },
    ])
    // After an inner break, the next step is the outer loop's update and check.
    expect(steps[steps.indexOf(breakSteps[0]) + 1]).toMatchObject({ line: 2, loop: { line: 2, iteration: 2 } })
  })

  it('runs comma-separated parts in a for header, merged into the loop check', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int arr[5] = {1, 2, 3, 4, 5};',
        '    int n = 5;',
        '    for (int i = 0, j = n - 1; i < j; i++, j--) {',
        '        int t = arr[i];',
        '        arr[i] = arr[j];',
        '        arr[j] = t;',
        '    }',
        '    printf("%d %d %d %d %d", arr[0], arr[1], arr[2], arr[3], arr[4]);',
        '    return 0;',
        '}',
      ),
    )
    expect(steps.at(-1)?.output).toBe('5 4 3 2 1')
    const checks = steps.filter((s) => s.line === 4)
    expect(checks.map(english)).toEqual([
      'Start the loop: create i and set it to 0 and create j and set it to 4. Check i < j: 0 < 4 is true, so run the loop body.',
      'Increase i to 1 and decrease j to 3. Check i < j: 1 < 3 is true, so run the loop body again.',
      'Increase i to 2 and decrease j to 2. Check i < j: 2 < 2 is false, so the loop ends.',
    ])
    // Both variables are marked as changed on the same step.
    expect(checks[1].changed).toEqual(['i', 'j'])
    expect(checks[1].variables.filter((v) => v.name === 'i' || v.name === 'j').map((v) => v.value)).toEqual(['1', '3'])
    expect(checks.map((s) => s.loop?.total ?? null)).toEqual([2, 2, null])

    // Assignments in the init, and three parts in the update, run left to right.
    const three = stepsOf(
      lines(
        'int main() {',
        '    int i, j, k = 0;',
        '    for (i = 0, j = 10; i < 2; i++, j -= 2, k += j) {',
        '        printf("%d %d %d|", i, j, k);',
        '    }',
        '    return 0;',
        '}',
      ),
    )
    expect(three.at(-1)?.output).toBe('0 10 0|1 8 8|')
    expect(english(three.filter((s) => s.line === 3)[1])).toBe(
      'Increase i to 1, set j to 8 and set k to 8. Check i < 2: 1 < 2 is true, so run the loop body again.',
    )
  })

  it('keeps the comma operator unsupported outside a for header', () => {
    const result = runUserCode(lines('int main() {', '    int i = 0, j = 0;', '    i++, j++;', '    return 0;', '}'))
    expect(result).toMatchObject({ error: { line: 3, text: { key: 'unsupported.comma' } } })
    const inBody = runUserCode(
      lines('int main() {', '    for (int i = 0; i < 2; i++) {', '        i++, i++;', '    }', '    return 0;', '}'),
    )
    expect(inBody).toMatchObject({ error: { line: 3, text: { key: 'unsupported.comma' } } })
  })

  it('reports break or continue outside a loop as a code error', () => {
    for (const keyword of ['break', 'continue']) {
      const result = runUserCode(lines('int main() {', '    int x = 1;', `    ${keyword};`, '    return 0;', '}'))
      expect('error' in result && result.error).toBeInstanceOf(CodeError)
      expect('error' in result && result.error).toMatchObject({ line: 3, text: { key: 'codeError.outsideLoop', values: { keyword } } })
    }
    // A function called from a loop is still outside it, as in real C.
    const result = runUserCode(lines('void f() {', '    break;', '}', 'int main() {', '    while (1) f();', '    return 0;', '}'))
    expect(result).toMatchObject({ error: { line: 2, text: { key: 'codeError.outsideLoop' } } })
  })

  describe('pointers', () => {
    it('points at a variable and changes it through the pointer', () => {
      const steps = stepsOf(
        lines(
          'int main() {',
          '    int x = 5;',
          '    int *p = &x;',
          '    int y = *p;',
          '    *p = 10;',
          '    int z = 2;',
          '    p = &z;',
          '    (*p)++;',
          '    return 0;',
          '}',
        ),
      )

      // Fake addresses: 0x100 for the first variable, then 4 higher each.
      expect(steps[0].variables).toEqual([{ name: 'x', value: '5', address: '0x100' }])
      expect(steps[1].variables[1]).toEqual({ name: 'p', value: '0x100', address: '0x104', isPointer: true, pointsTo: '0x100' })
      expect(english(steps[1])).toBe("Create pointer p and point it at x: it holds x's address, 0x100.")
      expect(english(steps[2])).toBe('*p follows p to x, which holds 5. Create y and set it to *p (5).')
      // Writing *p changes x, so x is the variable highlighted.
      expect(steps[3].changed).toEqual(['x'])
      expect(steps[3].variables[0]).toMatchObject({ name: 'x', value: '10' })
      expect(english(steps[3])).toBe('*p is x, the variable p points to, so this line changes x. Set *p to 10.')
      expect(steps[5].variables[1]).toMatchObject({ name: 'p', value: '0x10c', pointsTo: '0x10c' })
      expect(english(steps[5])).toBe("p now points to z: it holds z's address, 0x10c.")
      expect(steps[6]).toMatchObject({ changed: ['z'] })
      expect(steps[6].variables.find((v) => v.name === 'z')?.value).toBe('3')
    })

    it('keeps * as multiplication between two values and reads int *p, q as one pointer', () => {
      const steps = stepsOf(
        lines('int main() {', '    int x = 3, *p = &x, q = 4;', '    int y = x * *p * q;', '    return 0;', '}'),
      )
      expect(steps.at(-2)?.variables.find((v) => v.name === 'y')?.value).toBe('36')
      expect(steps[2].variables.find((v) => v.name === 'q')).toEqual({ name: 'q', value: '4', address: '0x108' })
    })

    it('compares pointers with NULL and with each other', () => {
      const steps = stepsOf(
        lines(
          'int main() {',
          '    int x = 1;',
          '    int *p = NULL;',
          '    if (p == NULL) {',
          '        p = &x;',
          '    }',
          '    int *q = p;',
          '    if (p == q && q != NULL) {',
          '        printf("same\\n");',
          '    }',
          '    return 0;',
          '}',
        ),
      )
      expect(steps[1].variables[1]).toEqual({ name: 'p', value: 'NULL', address: '0x104', isPointer: true })
      expect(english(steps[1])).toBe('Create pointer p and set it to NULL: it points to nothing for now.')
      expect(english(steps[2])).toBe('Check if p == NULL: NULL == NULL is true, so run the if block.')
      expect(steps.at(-1)?.output).toBe('same\n')
    })

    it('prints with %p the same made-up address the Variables panel shows', () => {
      const steps = stepsOf(
        lines(
          'int main() {',
          '    int son = 1;',
          '    int salom = 5;',
          '    int *ptr = &salom;',
          '    printf("%p\\n", ptr);',
          '    printf("%p %p\\n", &son, NULL);',
          '    ptr = NULL;',
          '    printf("%p\\n", ptr);',
          '    return 0;',
          '}',
        ),
      )
      const ptr = steps[2].variables.find((v) => v.name === 'ptr')
      expect(ptr?.value).toBe('0x104')
      expect(steps[3].output).toBe('0x104\n')
      expect(steps.at(-1)?.output).toBe('0x104\n0x100 NULL\nNULL\n')
    })

    it('reports %p on something that is not a pointer as a code error', () => {
      const cases: [string, string][] = [
        ['    printf("%p", x);', 'codeError.printfPointer'],
        ['    printf("%p", 5);', 'codeError.printfPointer'],
        ['    printf("%p", "hi");', 'codeError.printfPointer'],
        ['    printf("%p", p);', 'codeError.pointerNoValue'],
      ]
      for (const [line, key] of cases) {
        const result = runUserCode(lines('int main() {', '    int x = 1;', '    int *p;', line, '    return 0;', '}'))
        expect('error' in result && result.error).toBeInstanceOf(CodeError)
        expect('error' in result && { line: result.error.line, key: result.error.text.key }).toEqual({ line: 4, key })
      }
      // Other placeholders are still not supported.
      const result = runUserCode(lines('int main() {', '    printf("%x", 1);', '    return 0;', '}'))
      expect('error' in result && result.error.text.key).toBe('unsupported.placeholder')
    })

    it('shows no addresses in programs without pointers', () => {
      expect(stepsOf(lines('int main() {', '    int x = 1;', '    return 0;', '}'))[0].variables).toEqual([{ name: 'x', value: '1' }])
    })

    it('reports following a NULL, unset or ended pointer as a code error', () => {
      const cases: [string[], number, string][] = [
        [['int main() {', '    int *p = NULL;', '    int y = *p;', '    return 0;', '}'], 3, 'codeError.derefNull'],
        [['int main() {', '    int *p;', '    *p = 10;', '    return 0;', '}'], 3, 'codeError.derefUninit'],
        [['int main() {', '    int *p;', '    {', '        int x = 1;', '        p = &x;', '    }', '    *p = 2;', '    return 0;', '}'], 7, 'codeError.derefDangling'],
        [['int main() {', '    int x = 1;', '    int y = *x;', '    return 0;', '}'], 3, 'codeError.derefNotPointer'],
        [['int main() {', '    int x = 1;', '    int *p = &x;', '    int y = p + 0 * 1;', '    return 0;', '}'], 4, 'unsupported.pointerArithmetic'],
        [['int main() {', '    int x = 1;', '    int *p = &x;', '    printf("%d", p);', '    return 0;', '}'], 4, 'codeError.pointerAsNumber'],
        [['int main() {', '    int *p = 5;', '    return 0;', '}'], 2, 'codeError.notAddress'],
        [['int main() {', '    float f = 1.0;', '    int *p = &f;', '    return 0;', '}'], 3, 'codeError.pointerTypeMismatch'],
      ]
      for (const [code, line, key] of cases) {
        const result = runUserCode(lines(...code))
        expect('error' in result && { line: result.error.line, key: result.error.text.key }).toEqual({ line, key })
      }
      const error = runUserCode(lines('int main() {', '    int *p = NULL;', '    int y = *p;', '    return 0;', '}'))
      expect('error' in error && error.error).toBeInstanceOf(CodeError)
    })

    it('rejects pointer features outside the subset as not supported', () => {
      const cases: [string[], string][] = [
        [['int main() {', '    int x = 1;', '    int *p = &x;', '    p++;', '    return 0;', '}'], 'unsupported.pointerArithmetic'],
        [['int main() {', '    int x = 1;', '    int *p = &x;', '    *p++;', '    return 0;', '}'], 'unsupported.pointerArithmetic'],
        [['int main() {', '    int a[2];', '    int *p = &a[0];', '    return 0;', '}'], 'unsupported.pointerToArray'],
        [['void f(int *a) {', '}', 'int main() {', '    return 0;', '}'], 'unsupported.pointerParam'],
        [['int main() {', '    char *s = "hi";', '    return 0;', '}'], 'unsupported.stringPointer'],
      ]
      for (const [code, key] of cases) {
        const result = runUserCode(lines(...code))
        expect('error' in result && result.error).toBeInstanceOf(UnsupportedConstructError)
        expect('error' in result && result.error.text.key).toBe(key)
      }
    })
  })
})
