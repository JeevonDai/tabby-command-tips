import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges, HostListener } from '@angular/core'
import { MatchResult } from '../services/matching.service'

@Component({
  template: require('./dropdown.component.pug'),
  styles: [require('./dropdown.component.scss')],
})
export class DropdownComponent implements OnChanges {
  @Input() suggestions: MatchResult[] = []
  @Input() currentInput = ''
  @Input() showSourceTag = false
  @Input() visible = false

  @Output() selected = new EventEmitter<string>()
  @Output() cancelled = new EventEmitter<void>()
  @Output() tabPressed = new EventEmitter<void>()

  selectedIndex = 0

  @ViewChild('listContainer') listContainer: ElementRef | null = null

  ngOnChanges (changes: SimpleChanges): void {
    if (changes.suggestions) {
      this.selectedIndex = 0
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown (event: KeyboardEvent): void {
    if (!this.visible || this.suggestions.length === 0) return

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        this.moveUp()
        break
      case 'ArrowDown':
        event.preventDefault()
        event.stopPropagation()
        this.moveDown()
        break
      case 'Enter':
        event.preventDefault()
        event.stopPropagation()
        this.confirmSelected()
        break
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        this.confirmTab()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        this.cancel()
        break
    }
  }

  moveUp (): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--
      this.scrollToSelected()
    }
  }

  moveDown (): void {
    if (this.selectedIndex < this.suggestions.length - 1) {
      this.selectedIndex++
      this.scrollToSelected()
    }
  }

  confirmSelected (): void {
    if (this.suggestions.length > 0) {
      this.selected.emit(this.suggestions[this.selectedIndex].entry.command)
    }
  }

  confirmTab (): void {
    this.tabPressed.emit()
  }

  cancel (): void {
    this.cancelled.emit()
  }

  onItemHover (index: number): void {
    this.selectedIndex = index
  }

  onItemClick (index: number): void {
    this.selectedIndex = index
    this.confirmSelected()
  }

  private scrollToSelected (): void {
    if (!this.listContainer) return
    const container = this.listContainer.nativeElement
    const item = container.children[this.selectedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }
}
