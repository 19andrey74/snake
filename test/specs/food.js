'use strict';

var Food = require('../../src/js/food.js'),
	Element = require('../../src/js/element.js');

describe('Food', function () {
	describe('interface has a', function () {
		var food = new Food();
		it('method "feed()"', function () {
			expect(food.feed).toBeDefined();
		});
	});
	
	describe('recieves a', function () {
		var food = new Food();
		it('property "x" from a Base Element', function(){
			expect(food.x).toBeDefined();
		});
		it('property "y" from a Base Element', function(){
			expect(food.y).toBeDefined();
		});
		it('property "isVisible" from a Base Element', function(){
			expect(food.isVisible).toBeDefined();
		});
	});
	
	it('is instance of a Base Element', function () {
		var food = new Food();
		expect(food instanceof Element).toBe(true);
	});

	it('property "isVisible" is `true` by default', function () {
		var food = new Food();
		expect(food.isVisible).toBe(true);
	});

	it('has {x:0, y:0} coordinates by default', function () {
		var food = new Food();
		expect(food.x).toBe(0);
		expect(food.y).toBe(0);
	});
		
	describe('config argument correctly affects a', function () {
		var config = {
			x: 774,
			y: 88,
			isVisible: false
		}
		var food = new Food(config);
		it('property "x"', function(){
			expect(food.x).toEqual(config.x);
		});
		it('property "y"', function(){
			expect(food.y).toEqual(config.y);
		});
		it('property "isVisible"', function(){
			expect(food.isVisible).toEqual(config.isVisible);
		});
	});

	it('sets "isVisible" to `false`, when call "feed()"', function () {
		var food = new Food();
		food.feed();
		expect(food.isVisible).toBe(false);
	});
	
});
