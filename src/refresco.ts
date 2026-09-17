/**
 * Un efecto para pedir que el panel de presentacion se reconstruya.
 *
 * Vive en su propio modulo, y no en `livepreview.ts`, para que `widgets.ts`
 * pueda pedirlo sin importar a `livepreview`, que a su vez importa a `widgets`.
 * Sin esto habria un ciclo entre los dos.
 */

import { StateEffect } from '@codemirror/state'

export const refrescarPresentacion = StateEffect.define<null>()

export const pedirRefresco = () => refrescarPresentacion.of(null)
