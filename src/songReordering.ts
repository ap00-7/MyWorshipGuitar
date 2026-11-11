import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from 'react'

const activationDelay = 360
const movementTolerance = 10

type SongGesture = {
  songId: string
  startX: number
  startY: number
  active: boolean
  root: HTMLElement
  pointerId?: number
  touchId?: number
}

export function useSongReordering(songIds: string[], enabled: boolean, onReorder: (songIds: string[]) => void) {
  const [draggingSongId, setDraggingSongId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const gestureRef = useRef<SongGesture | null>(null)
  const activationTimerRef = useRef<number | null>(null)
  const detachListenersRef = useRef<(() => void) | null>(null)
  const currentSongIdsRef = useRef(songIds)
  const onReorderRef = useRef(onReorder)
  const dropIndexRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  currentSongIdsRef.current = songIds
  onReorderRef.current = onReorder

  const setDropPosition = (index: number | null) => {
    dropIndexRef.current = index
    setDropIndex(index)
  }

  const clearGesture = () => {
    if (activationTimerRef.current !== null) {
      window.clearTimeout(activationTimerRef.current)
      activationTimerRef.current = null
    }
    detachListenersRef.current?.()
    detachListenersRef.current = null
    gestureRef.current = null
    setDraggingSongId(null)
    setDropPosition(null)
  }

  const finishGesture = () => {
    const gesture = gestureRef.current
    const destinationIndex = dropIndexRef.current
    clearGesture()
    if (!gesture?.active || destinationIndex === null) return

    suppressClickRef.current = true
    const ids = [...currentSongIdsRef.current]
    const fromIndex = ids.indexOf(gesture.songId)
    if (fromIndex < 0) return
    const [songId] = ids.splice(fromIndex, 1)
    const insertIndex = Math.max(0, Math.min(ids.length, destinationIndex > fromIndex ? destinationIndex - 1 : destinationIndex))
    if (insertIndex === fromIndex) return
    ids.splice(insertIndex, 0, songId)
    onReorderRef.current(ids)
  }

  const updateDropPosition = (gesture: SongGesture, clientY: number) => {
    const rows = Array.from(gesture.root.querySelectorAll<HTMLElement>('[data-reorder-song-index]'))
    let position = rows.length
    for (let index = 0; index < rows.length; index += 1) {
      const bounds = rows[index].getBoundingClientRect()
      if (clientY < bounds.top + bounds.height / 2) {
        position = index
        break
      }
    }
    setDropPosition(position)
  }

  const startGesture = (songId: string, index: number, x: number, y: number, root: HTMLElement, pointerId?: number, touchId?: number) => {
    if (!enabled || gestureRef.current) return false
    suppressClickRef.current = false
    const gesture: SongGesture = { songId, startX: x, startY: y, active: false, root, pointerId, touchId }
    gestureRef.current = gesture
    activationTimerRef.current = window.setTimeout(() => {
      if (gestureRef.current !== gesture) return
      gesture.active = true
      setDraggingSongId(songId)
      setDropPosition(index)
    }, activationDelay)
    return true
  }

  const onPointerDown = (index: number, songId: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0) return
    const root = event.currentTarget.closest<HTMLElement>('.private-session-list, .sunday-list')
    if (!root) return
    if (!startGesture(songId, index, event.clientX, event.clientY, root, event.pointerId)) return

    const handleMove = (moveEvent: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== moveEvent.pointerId) return
      const distance = Math.hypot(moveEvent.clientX - gesture.startX, moveEvent.clientY - gesture.startY)
      if (!gesture.active && distance > movementTolerance) {
        clearGesture()
        return
      }
      if (gesture.active) {
        moveEvent.preventDefault()
        updateDropPosition(gesture, moveEvent.clientY)
      }
    }
    const handleEnd = (endEvent: PointerEvent) => {
      if (gestureRef.current?.pointerId !== endEvent.pointerId) return
      finishGesture()
    }
    const handleCancel = (cancelEvent: PointerEvent) => {
      if (gestureRef.current?.pointerId === cancelEvent.pointerId) clearGesture()
    }

    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleEnd)
    document.addEventListener('pointercancel', handleCancel)
    detachListenersRef.current = () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleEnd)
      document.removeEventListener('pointercancel', handleCancel)
    }
  }

  const onTouchStart = (index: number, songId: string) => (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) return
    const touch = event.changedTouches[0]
    const root = event.currentTarget.closest<HTMLElement>('.private-session-list, .sunday-list')
    if (!root) return
    if (!startGesture(songId, index, touch.clientX, touch.clientY, root, undefined, touch.identifier)) return

    const handleMove = (moveEvent: TouchEvent) => {
      const gesture = gestureRef.current
      const movedTouch = Array.from(moveEvent.changedTouches).find((item) => item.identifier === gesture?.touchId)
      if (!gesture || !movedTouch) return
      const distance = Math.hypot(movedTouch.clientX - gesture.startX, movedTouch.clientY - gesture.startY)
      if (!gesture.active && distance > movementTolerance) {
        clearGesture()
        return
      }
      if (gesture.active) {
        moveEvent.preventDefault()
        updateDropPosition(gesture, movedTouch.clientY)
      }
    }
    const handleEnd = (endEvent: TouchEvent) => {
      if (Array.from(endEvent.changedTouches).some((item) => item.identifier === gestureRef.current?.touchId)) finishGesture()
    }
    const handleCancel = (cancelEvent: TouchEvent) => {
      if (Array.from(cancelEvent.changedTouches).some((item) => item.identifier === gestureRef.current?.touchId)) clearGesture()
    }

    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleCancel)
    detachListenersRef.current = () => {
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleCancel)
    }
  }

  useEffect(() => () => {
    if (activationTimerRef.current !== null) window.clearTimeout(activationTimerRef.current)
    detachListenersRef.current?.()
  }, [])

  const getItemClassName = (index: number) => [
      draggingSongId === songIds[index] && 'schedule-song-dragging',
      dropIndex === index && 'schedule-song-drop-before',
      dropIndex === index + 1 && 'schedule-song-drop-after',
  ].filter(Boolean).join(' ')

  const getHandleProps = (index: number, songId: string, title: string) => ({
    onPointerDown: onPointerDown(index, songId),
    onTouchStart: onTouchStart(index, songId),
    'aria-label': `Press and hold to drag ${title}`,
    title: `Press and hold to drag ${title}`,
  })

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { getItemClassName, getHandleProps, onClickCapture }
}
