import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { createTheme, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { createRoot } from 'react-dom/client'

import App from './App'
import './index.css'

const theme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
})

createRoot(document.getElementById('root')!).render(
  <MantineProvider defaultColorScheme="dark" theme={theme}>
    <Notifications position="top-right" />
    <App />
  </MantineProvider>,
)
