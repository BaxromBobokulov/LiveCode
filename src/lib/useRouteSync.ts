import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { usePlaygroundStore } from '../store/playgroundStore'
import { findExampleBySlug, findProblemBySlug, parseRoute, playgroundPath, type Route } from './routes'

/**
 * Makes the store follow the URL, which decides what is open (see docs/specs/0002-url-routing-sections-items.md):
 * - an untidy or unknown path is replaced with its tidy form or its section's list;
 * - an item URL opens that problem or example, but only when it isn't the one already open, so moving
 *   between URLs that name the open item (a tab and back, Back/Forward) never resets the code;
 * - a bare / on the first load, with a problem or example saved by an earlier visit, is replaced with its URL;
 * - leaving the Playground stops auto play.
 * Returns the route the app should show.
 */
export function useRouteSync(): Route {
  const location = useLocation()
  const navigate = useNavigate()
  const { route, redirect } = useMemo(() => parseRoute(location.pathname), [location.pathname])

  // Opening the item: a layout effect runs before the browser paints, so the previous item never shows for
  // a frame. Safe to run twice (StrictMode does in development): the second run finds the item open.
  useLayoutEffect(() => {
    const store = usePlaygroundStore.getState()
    if (route.kind === 'problem') {
      const problem = findProblemBySlug(route.slug)!
      if (store.problemId !== problem.id) store.loadProblem(problem.id)
    } else if (route.kind === 'example') {
      const example = findExampleBySlug(route.slug)!
      // The example is open only while no problem is; exampleId stays set under an open problem.
      if (store.problemId !== null || store.exampleId !== example.id) store.loadExample(example.id)
    }
  }, [route])

  // Replacing the URL: a plain effect, because on the first render the router only starts listening for URL
  // changes in its own effect, which runs after this component's layout effects. A replace never changes
  // which screen shows (the tidy path names the same thing, and / already shows the saved item).
  useEffect(() => {
    if (redirect !== null) {
      navigate({ pathname: redirect, search: location.search, hash: location.hash }, { replace: true })
      return
    }
    const store = usePlaygroundStore.getState()
    if (location.pathname === '/' && location.key === 'default' && store.restoredFromSave) {
      // 'default' is the entry the app started on. Coming back to / later with Back is left alone.
      navigate(playgroundPath(store), { replace: true })
    }
  }, [redirect, location.key, location.pathname, location.search, location.hash, navigate])

  useEffect(() => {
    if (route.tab !== 'playground') usePlaygroundStore.getState().pause()
  }, [route.tab])

  return route
}
