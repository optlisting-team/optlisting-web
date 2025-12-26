import { useState, useRef, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'

/**
 * StepperNumberField - SaaS-style number input with stepper buttons
 * Supports:
 * - Direct number input
 * - Click increment/decrement
 * - Long press for continuous change
 * - Shift + click for bigStep
 */
export default function StepperNumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  bigStep,
  hint,
  icon,
  unit,
  className = ''
}) {
  const [inputValue, setInputValue] = useState(value?.toString() || '0')
  const [isFocused, setIsFocused] = useState(false)
  const intervalRef = useRef(null)
  const buttonRef = useRef({ minus: null, plus: null })

  // Sync input value when prop changes
  useEffect(() => {
    setInputValue(value?.toString() || '0')
  }, [value])

  // Clamp value to min/max
  const clampValue = (val) => {
    let num = parseInt(val) || min
    if (num < min) num = min
    if (max !== undefined && num > max) num = max
    return num
  }

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // Update parent only if valid number
    if (newValue === '' || newValue === '-') {
      return
    }
    
    const clamped = clampValue(newValue)
    if (onChange) {
      onChange(clamped)
    }
  }

  // Handle input blur - ensure valid value
  const handleInputBlur = () => {
    setIsFocused(false)
    const clamped = clampValue(inputValue)
    setInputValue(clamped.toString())
    if (onChange) {
      onChange(clamped)
    }
  }

  // Increment/decrement function
  const adjustValue = (direction, useBigStep = false) => {
    const current = clampValue(inputValue)
    const stepSize = useBigStep && bigStep ? bigStep : step
    const newValue = direction === 'plus' 
      ? clampValue(current + stepSize)
      : clampValue(current - stepSize)
    
    setInputValue(newValue.toString())
    if (onChange) {
      onChange(newValue)
    }
  }

  // Handle button click
  const handleButtonClick = (direction, e) => {
    e.preventDefault()
    e.stopPropagation()
    const useBigStep = e.shiftKey && bigStep
    adjustValue(direction, useBigStep)
  }

  // Handle button mouse down (start long press)
  const handleButtonMouseDown = (direction, e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const useBigStep = e.shiftKey && bigStep
    
    // Immediate first change
    adjustValue(direction, useBigStep)
    
    // Start interval for continuous change
    intervalRef.current = setInterval(() => {
      adjustValue(direction, useBigStep)
    }, 150) // 150ms interval for smooth continuous change
  }

  // Handle button mouse up (stop long press)
  const handleButtonMouseUp = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Handle button mouse leave (stop long press)
  const handleButtonMouseLeave = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Touch events for mobile
  const handleTouchStart = (direction, e) => {
    e.preventDefault()
    const useBigStep = false // Shift doesn't work on touch, use regular step
    adjustValue(direction, useBigStep)
    
    intervalRef.current = setInterval(() => {
      adjustValue(direction, useBigStep)
    }, 150)
  }

  const handleTouchEnd = (e) => {
    e.preventDefault()
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs text-zinc-500 uppercase font-medium">
          {label}
        </label>
      )}
      
      <div
        className={`
          flex items-center border rounded-lg transition-all
          ${isFocused 
            ? 'border-zinc-600 ring-2 ring-zinc-600/20' 
            : 'border-zinc-800 bg-zinc-900/50'
          }
        `}
      >
        {/* Minus Button */}
        <button
          type="button"
          ref={(el) => (buttonRef.current.minus = el)}
          onClick={(e) => handleButtonClick('minus', e)}
          onMouseDown={(e) => handleButtonMouseDown('minus', e)}
          onMouseUp={handleButtonMouseUp}
          onMouseLeave={handleButtonMouseLeave}
          onTouchStart={(e) => handleTouchStart('minus', e)}
          onTouchEnd={handleTouchEnd}
          disabled={clampValue(inputValue) <= min}
          className={`
            w-10 h-10 flex items-center justify-center
            border-r border-zinc-800
            text-zinc-400 hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-colors
            active:bg-zinc-800
          `}
          title={bigStep ? "Click: -1, Shift+Click: -" + bigStep : "Decrease by " + step}
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Input */}
        <div className="flex-1 flex items-center justify-center relative">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleInputBlur}
            min={min}
            max={max}
            step={step}
            className={`
              w-full h-10
              bg-transparent
              text-white text-sm font-bold text-center
              focus:outline-none
              [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none
              ${unit ? 'pr-8 pl-3' : 'px-3'}
            `}
          />
          {unit && (
            <span className="absolute right-3 text-xs text-zinc-600 pointer-events-none">
              {unit}
            </span>
          )}
        </div>

        {/* Plus Button */}
        <button
          type="button"
          ref={(el) => (buttonRef.current.plus = el)}
          onClick={(e) => handleButtonClick('plus', e)}
          onMouseDown={(e) => handleButtonMouseDown('plus', e)}
          onMouseUp={handleButtonMouseUp}
          onMouseLeave={handleButtonMouseLeave}
          onTouchStart={(e) => handleTouchStart('plus', e)}
          onTouchEnd={handleTouchEnd}
          disabled={max !== undefined && clampValue(inputValue) >= max}
          className={`
            w-10 h-10 flex items-center justify-center
            border-l border-zinc-800
            text-zinc-400 hover:text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-colors
            active:bg-zinc-800
          `}
          title={bigStep ? "Click: +1, Shift+Click: +" + bigStep : "Increase by " + step}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Hint */}
      {hint && (
        <p className="text-xs text-zinc-600">{hint}</p>
      )}
    </div>
  )
}

