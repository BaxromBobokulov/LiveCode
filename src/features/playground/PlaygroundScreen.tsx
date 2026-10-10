import { useEffect } from 'react'
import { AUTOPLAY_DELAY_MS } from '../../constants/playback'
import { usePlaygroundStore } from '../../store/playgroundStore'
import EditorPanel from './EditorPanel'
import ExecutionPanel from './ExecutionPanel'

function PlaygroundScreen() {
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const next = usePlaygroundStore((state) => state.next)

  // Auto Play: move one step forward after a short pause, until the store stops playing.
  useEffect(() => {
    if (!isPlaying) return
    const timer = setTimeout(next, AUTOPLAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isPlaying, stepIndex, next])

  return (
    <div className="flex flex-col gap-5 min-[1000px]:flex-row">
      <EditorPanel />
      <ExecutionPanel />
    </div>
  )
}

export default PlaygroundScreen
