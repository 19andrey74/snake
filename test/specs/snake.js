'use strict';

var Snake = require('../../src/js/snake.js'),
	SnakePart = require('../../src/js/snake.part.js');

describe('Snake', function () {
	describe('interface has a', function () {
		var snake = new Snake();
		it('property "parts[]"', function(){
			expect(snake.parts).toBeDefined();
		});
		it('property "head"', function(){
			expect(snake.head).not.toBeDefined();
		});
		it('property "length"', function(){
			expect(snake.length).toBeDefined();
		});
		it('property "direction"', function(){
			expect(snake.direction).toBeDefined();
		});
		it('method "eat()"', function(){
			expect(snake.eat).toBeDefined();
		});
		it('method "move()"', function(){
			expect(snake.move).toBeDefined();
		});
	});

	it('property "length" is `0` by default', function () {
		var snake = new Snake();
		expect(snake.length).toEqual(0);
	});
	
	describe('config argument correctly affects a', function () {
		var config = {
			direction: 'down',
			length: 5
		}
		var snake = new Snake(config);
		it('property "direction"', function(){
			expect(snake.direction).toEqual(config.direction);
		});
		it('property "length"', function(){
			expect(snake.length).toEqual(config.length);
		});
	});

	describe('parts has dinamic coordinates according to configuration', function () {
		it('length: 5, direction: down', function () {
			var config = {
				direction: 'down',
				length: 5
			}
			var snake = new Snake(config);
			[
				{ x: 0, y: 4 },
				{ x: 0, y: 3 },
				{ x: 0, y: 2 },
				{ x: 0, y: 1 },
				{ x: 0, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		});

		it('length: 3, direction: right', function () {
			var config = {
				direction: 'right',
				length: 3
			}
			var snake = new Snake(config);

			[
				{ x: 2, y: 0 },
				{ x: 1, y: 0 },
				{ x: 0, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		});

		it('length: 4, direction: left', function () {
			var config = {
				direction: 'left',
				length: 4
			}
			var snake = new Snake(config);

			[
				{ x: -3, y: 0 },
				{ x: -2, y: 0 },
				{ x: -1, y: 0 },
				{ x: 0, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		});

		it('length: 2, direction: up', function () {
			var config = {
				direction: 'up',
				length: 2
			}
			var snake = new Snake(config);

			[
				{ x: 0, y: -1 },
				{ x: 0, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		});
	});

	describe('parts has the same direction on initialization', function () {
		it('length: 5, direction: down', function () {
			var config = {
				direction: 'down',
				length: 5
			}
			var snake = new Snake(config);
			var allhasSameDirection = snake.parts.every(function (part) {
				return part.direction === config.direction;
			});
			expect(allhasSameDirection).toBe(true);
		});

		it('length: 3, direction: up', function () {
			var config = {
				direction: 'up',
				length: 3
			}
			var snake = new Snake(config);
			var allhasSameDirection = snake.parts.every(function (part) {
				return part.direction === config.direction;
			});
			expect(allhasSameDirection).toBe(true);
		});

		it('length: 50, direction: right', function () {
			var config = {
				direction: 'right',
				length: 50
			}
			var snake = new Snake(config);
			var allhasSameDirection = snake.parts.every(function (part) {
				return part.direction === config.direction;
			});
			expect(allhasSameDirection).toBe(true);
		});

		it('length: 13, direction: left', function () {
			var config = {
				direction: 'left',
				length: 13
			}
			var snake = new Snake(config);
			var allhasSameDirection = snake.parts.every(function (part) {
				return part.direction === config.direction;
			});
			expect(allhasSameDirection).toBe(true);
		});

	});

	describe('can eat', function () {
		it('when empty', function () {
			var config = {
				direction: 'down'
			}
			var snake = new Snake(config);
			var newSnakePart = {
				x: 0,
				y: -1
			}
			snake.eat();
			expect(snake.length).toEqual(1);
			expect(snake.length).toEqual(snake.parts.length);
			expect(snake.direction).toEqual(config.direction);
			expect(snake.direction).toEqual(snake.parts[0].direction);
			expect(snake.head).toBe(snake.parts[0]);
			expect(snake.head.x).toEqual(newSnakePart.x);
			expect(snake.head.y).toEqual(newSnakePart.y);
		});
		 
		it('when has length, new part is attached to the end', function () {
			var config = {
				direction: 'right',
				length: 10
			}
			var newSnakePart = {
				x: -1,
				y: 0,
				direction: 'right'
			}
			var snake = new Snake(config);
			var lastPart = snake.parts[snake.length - 1];
			snake.eat();

			expect(snake.length).toEqual(11);
			expect(snake.length).toEqual(snake.parts.length);
			expect(snake.direction).toEqual(config.direction);
			expect(snake.direction).toEqual(snake.parts[0].direction);
			expect(snake.head).toBe(snake.parts[0]);
			expect(snake.head).not.toEqual(newSnakePart);
			expect(snake.parts[snake.length - 1].x).toEqual(newSnakePart.x);
			expect(snake.parts[snake.length - 1].y).toEqual(newSnakePart.y);
			expect(lastPart.direction).toEqual(newSnakePart.direction);
		});
	});
	
	describe('can move', function () {
		it('one step forward', function () {
			var config = {
				direction: 'right',
				length: 5
			}
			var snake = new Snake(config);
			snake.move(1);
			[
				{ x: 5, y: 0 },
				{ x: 4, y: 0 },
				{ x: 3, y: 0 },
				{ x: 2, y: 0 },
				{ x: 1, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		})

		it('one step forward by default', function () {
			var config = {
				direction: 'right',
				length: 5
			}
			var snake = new Snake(config);
			snake.move();
			[
				{ x: 5, y: 0 },
				{ x: 4, y: 0 },
				{ x: 3, y: 0 },
				{ x: 2, y: 0 },
				{ x: 1, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		})

		it('5 steps forward', function () {
			var config = {
				direction: 'right',
				length: 5
			}
			var snake = new Snake(config);
			snake.move(5);
			[
				{ x: 9, y: 0 },
				{ x: 8, y: 0 },
				{ x: 7, y: 0 },
				{ x: 6, y: 0 },
				{ x: 5, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		});

		it('right(2)-down(2)', function () {
			var config = {
				direction: 'right',
				length: 5
			}
			var snake = new Snake(config);
			snake.direction = 'right';
			snake.move(2);
			snake.direction = 'down';
			snake.move(2);
			[
				{ x: 6, y: 2 },
				{ x: 6, y: 1 },
				{ x: 6, y: 0 },
				{ x: 5, y: 0 },
				{ x: 4, y: 0 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		})

		it('down(2)-right(3)-up(4)-left(5)', function () {
			var config = {
				direction: 'down',
				length: 5
			}
			var snake = new Snake(config);
			snake.direction = 'down';
			snake.move(2);
			snake.direction = 'right';
			snake.move(3);
			snake.direction = 'up';
			snake.move(4);
			snake.direction = 'left';
			snake.move(5);
			[
				{ x: -2, y: 2 },
				{ x: -1, y: 2 },
				{ x: 0, y: 2 },
				{ x: 1, y: 2 },
				{ x: 2, y: 2 }
			].forEach(function (coords, i) {
				expect({ x: snake.parts[i].x, y: snake.parts[i].y }).toEqual(coords);
			});
		})
	})
});

