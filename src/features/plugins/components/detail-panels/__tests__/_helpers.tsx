import { render } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import type { PluginConfigValue } from '@/shared/types'
import { ConfigPanel, seedWithLuaDefaults } from '../ConfigPanel'

type ConfigPanelTestProps = Omit<
  React.ComponentProps<typeof ConfigPanel>,
  'values' | 'onValuesChange'
>

export function ConfigPanelHarness(
  props: ConfigPanelTestProps,
): React.JSX.Element {
  const initialConfig: Record<string, PluginConfigValue> =
    props.displayInfo.status === 'installed'
      ? props.displayInfo.installed.config
      : {}

  const [values, setValues] = useState<Record<string, PluginConfigValue>>(() =>
    seedWithLuaDefaults(initialConfig, props.displayInfo.schema.options),
  )

  const prevSchemaIdRef = useRef(props.displayInfo.schema.id)
  const prevStatusRef = useRef(props.displayInfo.status)

  useEffect(() => {
    if (
      prevSchemaIdRef.current !== props.displayInfo.schema.id ||
      prevStatusRef.current !== props.displayInfo.status
    ) {
      const nextInitialConfig: Record<string, PluginConfigValue> =
        props.displayInfo.status === 'installed'
          ? props.displayInfo.installed.config
          : {}
      setValues(
        seedWithLuaDefaults(
          nextInitialConfig,
          props.displayInfo.schema.options,
        ),
      )
      prevSchemaIdRef.current = props.displayInfo.schema.id
      prevStatusRef.current = props.displayInfo.status
    }
  }, [props.displayInfo])

  return <ConfigPanel {...props} values={values} onValuesChange={setValues} />
}

export function renderControlledConfigPanel(props: ConfigPanelTestProps) {
  return render(<ConfigPanelHarness {...props} />)
}
