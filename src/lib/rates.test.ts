import { describe, expect, it } from 'vitest'
import { averageBinancePrice, parseBcv, parseVes } from '../../supabase/functions/refresh-rates/parse'

describe('tasa del BCV', () => {
  it('lee el número con coma decimal', () => {
    expect(parseVes('574,03777588')).toBeCloseTo(574.03777588)
    expect(parseVes('1.234,56')).toBeCloseTo(1234.56)
    expect(parseVes('abc')).toBeNull()
    expect(parseVes('0,00')).toBeNull()
  })

  it('encuentra dólar y euro por el contenedor', () => {
    const html = `
      <div id="euro" class="col-sm-12"><span> EUR </span><div class="centrado"><strong> 620,11223344 </strong></div></div>
      <div id="dolar" class="col-sm-12"><span> USD </span><div class="centrado"><strong> 574,03777588 </strong></div></div>`
    expect(parseBcv(html)).toEqual({ usd: 574.03777588, eur: 620.11223344 })
  })

  it('si no hay ids, usa la etiqueta de la moneda', () => {
    const html = `<span>USD</span><p><strong class="strong-tb">100,5</strong></p><span>EUR</span><strong>110,25</strong>`
    expect(parseBcv(html)).toEqual({ usd: 100.5, eur: 110.25 })
  })

  it('como último recurso, usa la posición de los bloques centrado', () => {
    const blocks = ['110,1', '1,1', '2,2', '3,3', '100,4']
      .map((value) => `<div class="col-sm-6 col-xs-6 centrado"><strong>${value}</strong></div>`)
      .join('')
    expect(parseBcv(blocks)).toEqual({ usd: 100.4, eur: 110.1 })
  })

  it('sin datos no inventa una tasa', () => {
    expect(parseBcv('<html>mantenimiento</html>')).toEqual({ usd: null, eur: null })
  })
})

describe('tasa de Binance P2P', () => {
  it('promedia los precios de los anuncios', () => {
    const body = { code: '000000', data: [{ adv: { price: '300.00' } }, { adv: { price: '310.00' } }, { adv: { price: 'x' } }] }
    expect(averageBinancePrice(body)).toBe(305)
  })

  it('descarta respuestas con error o vacías', () => {
    expect(averageBinancePrice({ code: '100001', data: [{ adv: { price: '300' } }] })).toBeNull()
    expect(averageBinancePrice({ code: '000000', data: [] })).toBeNull()
    expect(averageBinancePrice(null)).toBeNull()
  })
})
