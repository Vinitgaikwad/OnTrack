import { useEffect, useState } from 'react'

type CurrentWeather = {
  temperature_2m: number
  relative_humidity_2m: number
  wind_speed_10m: number
}

type WeatherResponse = {
  current: CurrentWeather
  current_units?: {
    temperature_2m: string
    relative_humidity_2m: string
    wind_speed_10m: string
  }
}

const CITY = { name: 'Berlin', latitude: 52.52, longitude: 13.41 }

export function Weather() {
  const [data, setData] = useState<WeatherResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchWeather = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        latitude: String(CITY.latitude),
        longitude: String(CITY.longitude),
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
      })
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [])

  if (isLoading && !data) {
    return <p className="text-zinc-400">Loading weather...</p>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchWeather}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  const units = data?.current_units

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Weather in {CITY.name}</h1>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="px-6 py-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-sm text-zinc-400">Temperature</p>
          <p className="text-2xl font-mono">
            {data?.current.temperature_2m}
            {units?.temperature_2m}
          </p>
        </div>
        <div className="px-6 py-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-sm text-zinc-400">Humidity</p>
          <p className="text-2xl font-mono">
            {data?.current.relative_humidity_2m}
            {units?.relative_humidity_2m}
          </p>
        </div>
        <div className="px-6 py-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <p className="text-sm text-zinc-400">Wind</p>
          <p className="text-2xl font-mono">
            {data?.current.wind_speed_10m}
            {units?.wind_speed_10m}
          </p>
        </div>
      </div>
      <button
        onClick={fetchWeather}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition disabled:opacity-50"
      >
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  )
}